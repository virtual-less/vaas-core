import * as assert from 'assert'
import * as path from 'path'
import { dynamicRun } from './index'

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
    [Symbol('test.scope.customContext')] : async function() {
        const hello = {}
        const exports = dynamicRun({
            code:`
                hello.a = 1
                exports.hello=hello;
            `,
            filename:path.join(__dirname,'test.run.add.js'),
            customContext:{
                hello
            }
        })
        assert.equal(
            exports.hello.a,
            1,
            'test.scope.customContext error'
        )
        
        assert.equal(
            // @ts-ignore
            hello.a,
            undefined,
            'test.scope.customContext error'
        )
    },
    [Symbol('test.scope.customContext.Array')] : async function() {
        const exports = dynamicRun({
            code:`
                exports.res=Array;
            `,
            filename:path.join(__dirname,'test.run.add.js'),
            customContext:{
                Array:null
            }
        })
        assert.equal(
            exports.res,
            null,
            'test.scope.customContext.Array error'
        )
    },
    [Symbol('test.scope.process')] : async function() {
        dynamicRun({
            code:`
                process.env.a = 1
            `,
            filename:path.join(__dirname,'test.run.add.js'),
        })    
        assert.equal(
            // @ts-ignore
            process.env.a,
            undefined,
            'test.scope.process error'
        )
    },
    [Symbol('test.scope.instanceof')] : async function() {
        const exports = dynamicRun({
            code:`
            exports.hello=[]
            `,
            filename:path.join(__dirname,'test.run.add.js'),
        })
        assert.equal(
            exports.hello instanceof Array,
            true,
            'test.scope.instanceof error'
        )
    },
    [Symbol('test.scope.Array')] : async function() {
        dynamicRun({
            code:`
            Array.aaa = 111
            `,
            filename:path.join(__dirname,'test.run.add.js'),
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
            exports.res = require('a')
            `,
            filename:path.join(__dirname,'test.run.add.js'),
            requireDependenceFunc:(name)=>{
                return {
                    name
                }
            }
        })
        assert.deepEqual(
            exports.res,
            {name:'a'},
            'test.require error'
        )
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

