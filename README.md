# @vaas/core
Virtual as a Service Core

# install
```sh
npm i @vaas/core
```

# example
 ```ts
import { dynamicRun, proxyData } from '@vaas/core'

 const exports = dynamicRun({
    code:`
        let res = 1+1;
        exports.res=res;
    `,
    filename:path.join(__dirname,'test.js'),
    extendVer:{
        var1:'data',
        var2:{key:'data'},
        process:proxyData(process), // Makes the now process variable unmodified
    },
    overwriteRequire:(callbackData)=>{
        if(callbackData.modulePath==='fs') {
            return {
                readFile:()=>{
                    // overwrite readFile someThing
                }
            }
        }
        if(callbackData.modulePath.indexOf(__dirname)!==0) {
            throw new Error(`Only module in the ${__dirname} can be require`)
        }
    }
})
 ```
