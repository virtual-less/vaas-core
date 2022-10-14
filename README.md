# vaas-core
Virtual as a Service Core

# install
```sh
npm i vaas-core
```

# example
 ```ts
import { dynamicRun, proxyData } from 'vaas-core'

 const exports = dynamicRun({
    code:`
        let res = 1+1;
        exports.res=res;
    `,
    filepath:path.join(__dirname,'test.js'),
    overwriteReadCodeSync:(filepath)=>{
        if(filepath===path.join(__dirname,'test.js')) {
            return `
                let res = 1+1;
                exports.res=res;
            `
        }
        return fs.readFileSync(filepath).toString()
    },
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
