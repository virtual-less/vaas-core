import * as assert from 'assert'
import * as path from 'path'
import { dynamicRun, proxyData } from '../index'

const testUnit = {
    [Symbol('test.run.add')] : async function() {
        const exports = dynamicRun({
            code:`
                let res = 1+1;
                exports.res=res;
            `,
            filename:path.join(__dirname,'test.run.add.js')
        })
        assert.equal(
            exports.res,
            2,
            'test.run.add error'
        )
    },
    [Symbol('test.scope.extendVer')] : async function() {
        const hello = {}
        const exports = dynamicRun({
            code:`
                hello.a = 1
                exports.hello=hello;
            `,
            filename:path.join(__dirname,'test.scope.extendVer.js'),
            extendVer:{
                hello
            }
        })
        assert.equal(
            exports.hello.a,
            1,
            'test.scope.extendVer error'
        )
    },
    [Symbol('test.scope.extendVer.Array')] : async function() {
        const exports = dynamicRun({
            code:`
                exports.res=Array;
            `,
            filename:path.join(__dirname,'test.scope.extendVer.Array.js'),
            extendVer:{
                Array:null
            }
        })
        assert.equal(
            exports.res,
            null,
            'test.scope.extendVer.Array error'
        )
    },
    [Symbol('test.scope.process')] : async function() {
        dynamicRun({
            code:`
                process.env.a = 1
            `,
            filename:path.join(__dirname,'test.scope.process.js'),
            extendVer:{
                process
            }
        })    
        assert.equal(
            // @ts-ignore
            process.env.a,
            1,
            'test.scope.process error'
        )
    },
    [Symbol('test.scope.process.proxyData')] : async function() {
        dynamicRun({
            code:`
                process.env.b = 1
            `,
            filename:path.join(__dirname,'test.scope.process.js'),
            extendVer:{
                process:proxyData(process)
            }
        })    
        assert.equal(
            // @ts-ignore
            process.env.b,
            undefined,
            'test.scope.process.proxyData error'
        )
    },
    [Symbol('test.scope.instanceof')] : async function() {
        const extendVer:{[key:string]:any} = {}
        const exports = dynamicRun({
            code:`
            const instanceofHello = require('./instanceof.js')
            exports.res= instanceofHello.hello instanceof Array
            `,
            filename:path.join(__dirname,'test.scope.instanceof.js'),
            extendVer
        })
        assert.equal(
            exports.res,
            true,
            'test.scope.instanceof error'
        )
    },
    [Symbol('test.scope.Array')] : async function() {
        dynamicRun({
            code:`
            Array.aaa = 111
            `,
            filename:path.join(__dirname,'test.scope.Array.js'),
        })
        assert.equal(
            // @ts-ignore
            Array.aaa,
            undefined,
            'test.scope.Array error'
        )
    },
    [Symbol('test.require')] : async function() {
        const exports = dynamicRun({
            code:`
            exports.res = require('./a.js')
            `,
            filename:path.join(__dirname,'test.require.js'),
        })
        assert.deepEqual(
            exports.res,
            {name:'a'},
            'test.require error'
        )
    },
    [Symbol('test.vmTimeout')] : async function() {
        try {
            dynamicRun({
                code:`
                while(true) {}
                `,
                filename:path.join(__dirname,'test.require.js'),
                vmTimeout:3000
            })
        } catch (error) {
            assert.deepEqual(
                error.message,
                'Script execution timed out after 3000ms',
                'test.vmTimeout error'
            )
        }
        
    },
}


async function run(testUnitList) {
    for(let testUnitValue of testUnitList) {
        for(let testFunc of Object.getOwnPropertySymbols(testUnitValue)) {
            await testUnitValue[testFunc]();
        }
    }
}
(async function() {
    try{
        await run([testUnit]);
    } catch(err) {
        console.log(err)
    }
})();

