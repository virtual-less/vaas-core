import * as assert from 'assert'
import { describe, it } from 'mocha'
import * as path from 'path'
import * as fs from 'fs'
import { dynamicRun, proxyData } from '../index'

describe('test', function () {
  it('test.run.add', async function () {
    const exports = dynamicRun({
      filepath: path.join(__dirname, 'test.run.add.js'),
      overwriteReadCodeSync: () => {
        return `
                let res = 1+1;
                exports.res=res;
            `
      }
    })
    assert.equal(
      exports.res,
      2,
      'test.run.add error'
    )
  })

  it('test.scope.extendVer', async function () {
    const hello = {}
    const exports = dynamicRun({
      filepath: path.join(__dirname, 'test.scope.extendVer.js'),
      overwriteReadCodeSync: () => {
        return `
                hello.a = 1
                exports.hello=hello;
            `
      },
      extendVer: {
        hello
      }
    })
    assert.equal(
      exports.hello.a,
      1,
      'test.scope.extendVer error'
    )
  })

  it('test.scope.extendVer.Array', async function () {
    const exports = dynamicRun({
      filepath: path.join(__dirname, 'test.scope.extendVer.Array.js'),
      overwriteReadCodeSync: () => {
        return 'exports.res=Array;'
      },
      extendVer: {
        Array: null
      }
    })
    assert.equal(
      exports.res,
      null,
      'test.scope.extendVer.Array error'
    )
  })

  it('test.scope.process', async function () {
    dynamicRun({
      filepath: path.join(__dirname, 'test.scope.process.js'),
      overwriteReadCodeSync: () => {
        return 'process.env.a = 1'
      },
      extendVer: {
        process
      }
    })
    assert.equal(
      process.env.a,
      1,
      'test.scope.process error'
    )
  })

  it('test.scope.process.proxyData', async function () {
    dynamicRun({
      filepath: path.join(__dirname, 'test.scope.process.js'),
      overwriteReadCodeSync: () => {
        return 'process.env.b = 1'
      },
      extendVer: {
        process: proxyData(process)
      }
    })
    assert.equal(
      process.env.b,
      undefined,
      'test.scope.process.proxyData error'
    )
  })

  it('test.scope.instanceof', async function () {
    const extendVer: Record<string, any> = {}
    const exports = dynamicRun({
      filepath: path.join(__dirname, 'test.scope.instanceof.js'),
      overwriteReadCodeSync: (filepath) => {
        if (filepath === path.join(__dirname, 'test.scope.instanceof.js')) {
          return `
                    const instanceofHello = require('./instanceof.js')
                    exports.res= instanceofHello.hello instanceof Array
                    `
        }
        return fs.readFileSync(filepath).toString()
      },
      extendVer
    })
    assert.equal(
      exports.res,
      true,
      'test.scope.instanceof error'
    )
  })

  it('test.scope.Array', async function () {
    dynamicRun({
      filepath: path.join(__dirname, 'test.scope.Array.js'),
      overwriteReadCodeSync: () => {
        return 'Array.aaa = 111'
      }
    })
    assert.equal(
      // @ts-expect-error
      Array.aaa,
      undefined,
      'test.scope.Array error'
    )
  })

  it('test.require', async function () {
    const exports = dynamicRun({
      filepath: path.join(__dirname, 'test.require.js'),
      overwriteReadCodeSync: (filepath) => {
        if (filepath === path.join(__dirname, 'test.require.js')) {
          return 'exports.res = require(\'./a.js\')'
        }
        return fs.readFileSync(filepath).toString()
      }
    })
    assert.deepEqual(
      exports.res,
      { name: 'a' },
      'test.require error'
    )
  })

  it('test.vmTimeout', async function () {
    try {
      dynamicRun({
        filepath: path.join(__dirname, 'test.vmTimeout.js'),
        vmTimeout: 3000,
        overwriteReadCodeSync: () => {
          return 'while(true) {}'
        }
      })
    } catch (error) {
      assert.deepEqual(
        error.message,
        'Script execution timed out after 3000ms',
        'test.vmTimeout error'
      )
    }
  })

  it('test.buffer', async function () {
    const exports = dynamicRun({
      filepath: path.join(__dirname, 'test.buffer.js'),
      vmTimeout: 3000,
      isGlobalContext: true,
      overwriteReadCodeSync: () => {
        return 'exports.buf = Buffer.from([1]).toString()'
      }
    })
    assert.equal(
      exports.buf,
      Buffer.from([1]).toString(),
      'test.buffer error'
    )
  })

  it('test.overwriteRequire', async function () {
    const exports = dynamicRun({
      filepath: path.join(__dirname, 'test.overwriteRequire.js'),
      vmTimeout: 3000,
      overwriteRequire: (callbackData) => {
        return callbackData.modulePath
      },
      overwriteReadCodeSync: () => {
        return 'exports.fs = require(\'fs\')'
      }
    })
    assert.equal(
      exports.fs,
      'fs',
      'test.overwriteRequire error'
    )
  })
})
