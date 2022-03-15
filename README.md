# vaas-core
Virtual as a Service Core

# example
 ```ts
import { dynamicRun } from 'vaas-core'

 const exports = dynamicRun({
    code:`
        let res = 1+1;
        exports.res=res;
    `,
    filename:path.join(__dirname,'test.run.add.js'),
    customContext:{
        Array:null
    },
    requireDependenceFunc:(name)=>{
        return require(name)
    }
})
 ```
