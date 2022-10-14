import { readFileSync } from 'fs';
import { createRequire } from 'module';
import * as  path from 'path';
import * as  vm from 'vm';
import * as  os from 'os';

export interface DynamicRunParamsType {
    filepath:string,
    vmTimeout?:number,
    extendVer?:NodeJS.Dict<any>,
    overwriteRequire?:OverwriteRequire
    overwriteReadCodeSync?:OverwriteReadCodeSync
}

export interface OverwriteRequire{
    (callbackData:{
        nativeRequire:NodeRequire,
        filepath:string,
        moduleId:string,
        modulePath:string
    }): any
}
export interface OverwriteReadCodeSync{
    (filepath:string): string
}
interface InnerRunParamsType extends DynamicRunParamsType  {
    context:vm.Context,
    vmTimeout:number,
    extendVer:NodeJS.Dict<any>,
    overwriteRequire:OverwriteRequire
    overwriteReadCodeSync:OverwriteReadCodeSync
}

function genModuleRequire({
    filepath, vmTimeout, 
    context, extendVer, overwriteRequire,
    overwriteReadCodeSync
}:InnerRunParamsType):Function {
    return (moduleId) => {
        const nativeRequire:NodeRequire = createRequire(filepath);
        const modulePath = nativeRequire.resolve(moduleId);
        const module = overwriteRequire({
            nativeRequire,
            filepath,
            moduleId,
            modulePath
        })
        if(module) {return module}
        return innerRun({
            vmTimeout,
            filepath:modulePath, 
            context,
            extendVer,
            overwriteRequire,
            overwriteReadCodeSync
        })
    }
}

export function proxyData<T extends Object>(data:T):T {
    if(
       !(data instanceof Object)
    ) {
        return data;
    }
    let proxyValue = {}
    return new Proxy<T>(data, {
        get(target, propKey, receiver) {
            if(!proxyValue[propKey]) {
                proxyValue[propKey] = proxyData(Reflect.get(target, propKey, receiver))
            }
            const propertyDescriptor = Reflect.getOwnPropertyDescriptor(target, propKey)
            if(propertyDescriptor && propertyDescriptor.configurable===false) {
                return proxyValue[propKey]
            }
            return proxyValue[propKey];
        },
        getPrototypeOf(target) {
            return proxyData(Reflect.getPrototypeOf(target));
        },
        getOwnPropertyDescriptor(target, propKey) {
            console.log()
            if(!proxyValue[propKey]) {
                Reflect.getOwnPropertyDescriptor(target, propKey)
            }
            return Reflect.getOwnPropertyDescriptor(proxyValue, propKey)
        },
        set(_target, propKey, value, receiver) {
            return Reflect.set(proxyValue, propKey, value, receiver);
        },
        setPrototypeOf(_target, _value) {
            return false
        },
        deleteProperty(_target, propKey) {
            return Reflect.deleteProperty(proxyValue,propKey)
        },
        defineProperty(_target, propKey, propDesc) {
            return Reflect.defineProperty(proxyValue, propKey, propDesc)
        },
        has(target, propKey) {
            return Reflect.has(proxyValue, propKey) || Reflect.has(target, propKey)
        },
        ownKeys(target) {
            return [...new Set([...Object.keys(target),...Object.keys(proxyValue)]).values()]
        }
  })
}

function innerRun({
    context,
    filepath,
    extendVer,
    vmTimeout,
    overwriteRequire,
    overwriteReadCodeSync
}:InnerRunParamsType) {
    const vmRequire:Function = genModuleRequire({
        filepath, vmTimeout, 
        context, extendVer, overwriteRequire,overwriteReadCodeSync
    });
    
    const vmModule:{
        exports:NodeJS.Dict<any>
    } = {exports:{}}
    const moduleParams = {
        require:vmRequire,
        module:vmModule,
        exports:vmModule.exports,
        __filename:filepath,
        __dirname:path.dirname(filepath),
        console:proxyData(console),
        ...extendVer
    }
    const moduleParamsKeys = Object.keys(moduleParams)
    if(!context.moduleData) {context.moduleData = {}}
    context.moduleData[filepath] = moduleParams;
    const vmOption:any = {
        filename:filepath,
        lineOffset:1,
    }
    if(vmTimeout>0) {
        vmOption.timeout = vmTimeout
    }
    vm.runInContext(
        `moduleData['${filepath}'].moduleFunction = function (
            ${moduleParamsKeys.join(',')}
        ) {`+os.EOL+
        overwriteReadCodeSync(filepath)
        +os.EOL+`};
        moduleData['${filepath}'].moduleFunction(
            ${moduleParamsKeys.map(key=>`moduleData['${filepath}'].${key}`).join(',')}
        )`, 
        context, vmOption
    )
    return vmModule.exports;
}

export function dynamicRun({
    filepath,
    extendVer={},
    vmTimeout=0,
    overwriteRequire=()=>{},
    overwriteReadCodeSync=(filepath)=>{return readFileSync(filepath).toString()}
}:DynamicRunParamsType) {
    if(!path.isAbsolute(filepath)) {
        throw new Error('filepath must be absolute path')
    }
    const context = vm.createContext()
    return innerRun({
        context,
        extendVer,
        filepath,
        vmTimeout,
        overwriteRequire,
        overwriteReadCodeSync
    })
}