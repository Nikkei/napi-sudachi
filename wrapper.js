// Set NAPI_SUDACHI_ROOT environment variable before loading the native module
const path = require('path')

// Find the package root using require.resolve with relative path
const packageJsonPath = require.resolve('./package.json')
const packageRoot = path.dirname(packageJsonPath)

// Set environment variable
process.env.NAPI_SUDACHI_ROOT = packageRoot

// Load the actual native module
module.exports = require('./index.js')
