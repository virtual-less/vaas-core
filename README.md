# vaas-core
Virtual as a Service Core

# example
 ```ts
import { dynamicRun, proxyData } from 'vaas-core'

 const exports = dynamicRun({
    code:`
        let res = 1+1;
        exports.res=res;
    `,
    filename:path.join(__dirname,'test.run.add.js'),
    extendVer:{
        var1:'data',
        var2:{key:'data'},
        process:proxyData(process) // Makes the now process variable unmodified
    }
})
 ```
