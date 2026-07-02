/** Sudachi.rs の fetch_dictionary.sh を js で実装 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const yauzl = require('yauzl')
const https = require('node:https')

function cleanupTempDirForZip(zipPath) {
  const tempDir = path.dirname(zipPath)
  fs.rmSync(tempDir, { recursive: true, force: true })
}

/**
 * ZIPファイルからsystem_${dictType}.dicを抽出する
 * 保存ファイル名は system.dic で固定
 * 保存先ディレクトリは存在する前提
 * @param {string} zipPath ZIPファイルのパス
 * @param {string} dictType 辞書のタイプ
 * @param {string} targetDir 保存先ディレクトリ
 */
function extractSystemDic(zipPath, dictType, targetDir) {
  if (!fs.existsSync(zipPath)) {
    console.error(`ZIP file not found: ${zipPath}`)
    cleanupTempDirForZip(zipPath)
    return
  }
  yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
    if (err) throw err
    let found = false
    zipfile.readEntry()
    zipfile.on('entry', (entry) => {
      if (entry.fileName.endsWith(`system_${dictType}.dic`)) {
        found = true
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) throw err

          const targetPath = path.join(targetDir, 'system.dic')
          const writeStream = fs.createWriteStream(targetPath)

          readStream.pipe(writeStream)
          writeStream.on('close', () => {
            console.log(`Dictionary saved to: ${targetPath}`)
            // クリーンアップ
            zipfile.close(() => {
              cleanupTempDirForZip(zipPath)
            })
          })
        })
      } else {
        zipfile.readEntry()
      }
    })
    // 辞書が見つからなかった場合は zip ファイルを削除してエラー終了
    zipfile.on('end', () => {
      if (!found) {
        console.error(`system_${dictType}.dic not found in zip`)
        zipfile.close(() => {
          cleanupTempDirForZip(zipPath)
          process.exit(1)
        })
      }
    })
  })
}

/**
 * リダイレクトに追従しつつ GET する (latest の場合、最新の url にリダイレクトするため)
 * @param {string} url
 * @param {(response: import('node:http').IncomingMessage) => void} onResponse
 * @param {number} [maxRedirects]
 */
function httpsGetFollowRedirects(url, onResponse, maxRedirects = 1) {
  https
    .get(url, (response) => {
      const { statusCode, headers } = response
      if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
        if (maxRedirects <= 0) {
          response.resume()
          throw new Error(`Too many redirects while fetching: ${url}`)
        }
        const nextUrl = new URL(headers.location, url).toString()
        const nextUrlObj = new URL(nextUrl)
        const currentUrlObj = new URL(url)

        if (nextUrlObj.protocol !== 'https:') {
          response.resume()
          throw new Error(`Invalid redirect protocol: ${nextUrl}`)
        }

        if (nextUrlObj.origin !== currentUrlObj.origin) {
          response.resume()
          throw new Error(`Invalid redirect destination: ${nextUrl}`)
        }

        console.log(`Redirected (${statusCode}) to: ${nextUrl}`)
        response.resume()
        httpsGetFollowRedirects(nextUrl, onResponse, maxRedirects - 1)
        return
      }
      onResponse(response)
    })
    .on('error', (err) => {
      console.error('Download error:', err)
      throw err
    })
}

/**
 * 辞書をダウンロードして解凍し、system.dic を ResourceDir に移動する
 * @param {string} dictName 辞書の名前
 * @param {string} dictType 辞書のタイプ
 * @param {string} resourceDir 辞書を保存するディレクトリ
 */
function downloadDictionary(dictName, dictType, resourceDir) {
  const url = `https://d2ej7fkh96fzlu.cloudfront.net/sudachidict/${dictName}.zip`
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sudachi-dict-'))
  const zipPath = path.join(tempDir, 'dictionary.zip')

  console.log(`Downloading from: ${url}`)

  // 保存先ディレクトリを作成
  if (!fs.existsSync(resourceDir)) {
    fs.mkdirSync(resourceDir, { recursive: true })
    console.log(`Created directory: ${resourceDir}`)
  }

  httpsGetFollowRedirects(url, (response) => {
    if (response.statusCode !== 200) {
      response.resume()
      throw new Error(`Download failed with status code: ${response.statusCode}`)
    }
    const writer = fs.createWriteStream(zipPath)
    response.pipe(writer)

    writer.on('finish', () => {
      console.log(`Downloaded to: ${zipPath}`)
      console.log('Download completed, extracting...')
      extractSystemDic(zipPath, dictType, resourceDir)
    })
    // zipPath が作成されない場合、ファイルを削除
    writer.on('error', (err) => {
      console.error(`Error writing to file ${zipPath}:`, err)
      fs.unlink(zipPath, () => {})
      cleanupTempDirForZip(zipPath)
    })
  })
}

function main() {
  // 引数で DICT_VERSION と DICT_TYPE を受け取る
  const dictVersion = process.argv[2] || 'latest'
  const dictType = process.argv[3] || 'core'
  const allowedDictTypes = new Set(['small', 'core', 'full'])
  const isValidDictVersion = dictVersion === 'latest' || /^\d{8}$/.test(dictVersion)

  if (!allowedDictTypes.has(dictType)) {
    console.error(`Invalid dictType: ${dictType}. Allowed values are: small, core, full`)
    process.exit(1)
  }

  if (!isValidDictVersion) {
    console.error(`Invalid dictVersion: ${dictVersion}. Allowed values are: latest or YYYYMMDD`)
    process.exit(1)
  }

  const dictName = `sudachi-dictionary-${dictVersion}-${dictType}`

  console.log(`Downloading a dictionary file \`${dictName}\` ...`)

  const resourceDir = path.join(__dirname, '..', 'resources')
  console.log(`Resource directory: ${resourceDir}`)
  downloadDictionary(dictName, dictType, resourceDir)
}

main()
