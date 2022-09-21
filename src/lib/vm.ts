import { readFileSync } from 'fs';
import { createRequire } from 'module';
import * as  path from 'path';
import * as  vm from 'vm';
import * as  os from 'os';

function genModuleRequire({
    filename, vmTimeout, context, extendVer
}:{
    filename:string,
    vmTimeout:number,
    context:NodeJS.Dict<any>,
    extendVer:NodeJS.Dict<any>,
}):Function {
    return (moduleId) => {
        const newRequire:NodeRequire = createRequire(filename);
        const modulePath = newRequire.resolve(moduleId);
        return innerRun({
            code:readFileSync(modulePath).toString(),
            vmTimeout,
            filename:modulePath, 
            context,
            extendVer,
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

export interface dynamicRunParamsType {
    code:string,
    filename:string,
    vmTimeout?:number,
    extendVer?:NodeJS.Dict<any>,
}
interface innerRunParamsType extends dynamicRunParamsType  {
    context?:NodeJS.Dict<any>,
}

function innerRun({
    context,
    code,
    filename,
    extendVer,
    vmTimeout=30000
}:innerRunParamsType) {
    const vmRequire:Function = genModuleRequire({
        filename, vmTimeout, context, extendVer
    });
    
    const vmModule:{
        exports:NodeJS.Dict<any>
    } = {exports:{}}
    const moduleParams = {
        require:vmRequire,
        module:vmModule,
        exports:vmModule.exports,
        __filename:filename,
        __dirname:path.dirname(filename),
        console:proxyData(console),
        ...extendVer
    }
    const moduleParamsKeys = Object.keys(moduleParams)
    if(!context.moduleData) {context.moduleData = {}}
    context.moduleData[filename] = moduleParams;
    vm.runInContext(
        `moduleData['${filename}'].moduleFunction = function (
            ${moduleParamsKeys.join(',')}
        ) {`+os.EOL+
        code
        +os.EOL+`};
        moduleData['${filename}'].moduleFunction(
            ${moduleParamsKeys.map(key=>`moduleData['${filename}'].${key}`).join(',')}
        )`, 
        context, {
            filename:filename,
            lineOffset:1,
            timeout:vmTimeout
        }
    )
    return vmModule.exports;
}

export function dynamicRun({
    code,
    filename,
    extendVer={},
    vmTimeout=30000
}:dynamicRunParamsType) {
    if(!path.isAbsolute(filename)) {
        throw new Error('filename must be absolute path')
    }
    const context = vm.createContext()
    return innerRun({
        context,
        code,
        extendVer,
        filename,
        vmTimeout
    })
}