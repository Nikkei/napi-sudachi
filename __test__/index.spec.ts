import test from 'ava'

import path from 'path'
import { Tokenizer, SplitMode } from '../index'

// このコードの親フォルダをNAPI_SUDACHI_ROOTに設定
process.env.NAPI_SUDACHI_ROOT = path.resolve(import.meta.dirname, '..')

test('Test tokenize', (t) => {
  const tokenizer = new Tokenizer()
  const result = tokenizer.tokenize('今日は良い天気', SplitMode.c())
  t.is(result.length, 4)
  t.is(result[0].surface, '今日')
  t.is(result[1].surface, 'は')
  t.is(result[2].surface, '良い')
  t.is(result[3].surface, '天気')
})

test('Test tokenize with default mode', (t) => {
  const tokenizer = new Tokenizer()
  const result = tokenizer.tokenize('今日は良い天気')
  t.is(result.length, 4)
  t.is(result[0].surface, '今日')
  t.is(result[1].surface, 'は')
  t.is(result[2].surface, '良い')
  t.is(result[3].surface, '天気')
})

test('Morpheme properties', (t) => {
  const tokenizer = new Tokenizer()
  const result = tokenizer.tokenize('今日は良い天気', SplitMode.c())
  t.is(result[0].begin, 0)
  t.is(result[0].end, 6)
  t.is(result[0].beginC, 0)
  t.is(result[0].endC, 2)
  t.is(result[0].index, 0)
  t.is(result[0].partOfSpeechId, 11)
  t.is(result[0].surface, '今日')
  t.deepEqual(result[0].partOfSpeech, ['名詞', '普通名詞', '副詞可能', '*', '*', '*'])
  t.is(result[0].normalizedForm, '今日')
  t.is(result[0].dictionaryForm, '今日')
  t.is(result[0].readingForm, 'キョウ')
  t.is(result[0].dictionaryId, 0)
})

// 空文字列の tokenize 結果
test('empty string yields empty morpheme list', (t) => {
  const tokenizer = new Tokenizer()
  const result = tokenizer.tokenize('', SplitMode.c())
  t.deepEqual(result, [])
  t.is(result.length, 0)
})

// split mode A で解析すると「東京」「都」に分かれる
test('京都東京都 in mode A segments 東京都 into 東京 and 都 with global offsets', (t) => {
  const tokenizer = new Tokenizer()
  const result = tokenizer.tokenize('京都東京都', SplitMode.a())

  t.is(result.length, 3)
  t.deepEqual(
    result.map((m) => m.surface),
    ['京都', '東京', '都'],
  )
  t.deepEqual(
    result.map((m) => m.begin),
    [0, 6, 12],
  )
  t.deepEqual(
    result.map((m) => m.end),
    [6, 12, 15],
  )
  t.deepEqual(
    result.map((m) => m.beginC),
    [0, 2, 4],
  )
  t.deepEqual(
    result.map((m) => m.endC),
    [2, 4, 5],
  )
})

test('last morpheme has index length minus one', (t) => {
  const tokenizer = new Tokenizer()
  const result = tokenizer.tokenize('今日は良い天気', SplitMode.c())
  t.is(result[result.length - 1].index, result.length - 1)
})

// dictionary form for 動詞, 形容詞
test('dictionary form and normalized form for 動詞, 形容詞', (t) => {
  const tokenizer = new Tokenizer()
  const result = tokenizer.tokenize('小さく分けて出力した。', SplitMode.c())

  // test '小さく'
  t.is(result[0].surface, '小さく')
  t.is(result[0].dictionaryForm, '小さい')
  t.is(result[0].normalizedForm, '小さい')

  // test '分けて'
  t.is(result[1].surface, '分け')
  t.is(result[1].dictionaryForm, '分ける')
  t.is(result[1].normalizedForm, '分ける')

  // test 'した'
  t.is(result[4].surface, 'し')
  t.is(result[4].dictionaryForm, 'する')
  t.is(result[4].normalizedForm, '為る')
})

// normalize form
test('normalize form 打込む とき is 打ち込む 時', (t) => {
  const tokenizer = new Tokenizer()
  const result = tokenizer.tokenize('打込むとき。', SplitMode.c())
  // test '打込む'
  t.is(result[0].surface, '打込む')
  t.is(result[0].normalizedForm, '打ち込む')
  t.is(result[0].begin, 0)
  t.is(result[0].end, 9)
  t.is(result[0].beginC, 0)
  t.is(result[0].endC, 3)
  t.is(result[0].index, 0)
  // test 'とき'
  t.is(result[1].surface, 'とき')
  t.is(result[1].normalizedForm, '時')
  t.is(result[1].begin, 9)
  t.is(result[1].end, 15)
  t.is(result[1].beginC, 3)
  t.is(result[1].endC, 5)
  t.is(result[1].index, 1)
})
