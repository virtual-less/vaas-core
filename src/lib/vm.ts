import { readFileSync } from 'fs';
import { createRequire } from 'module';
import * as  path from 'path';
import * as  vm from 'vm';

type ObjectMap = {
    [key:string]:any
}

function genModuleRequire({
    filename, customContext, requireDependenceFunc
}:{
    filename:string,customContext:ObjectMap,requireDependenceFunc:Function
}):Function {
    return (moduleId) => {
        const module = requireDependenceFunc(moduleId)
        if(module) {
            return module
        }
        const newRequire:NodeRequire = createRequire(filename);
        const modulePath = newRequire.resolve(moduleId);
        if(
            moduleId[0]==='.' ||  moduleId[0]==='/'
        ) {
            return dynamicRun({
                code:readFileSync(modulePath).toString(),
                filename:modulePath, 
                customContext, 
                requireDependenceFunc
            })
        }
        throw new Error(`模块[${moduleId}]不存在`)
    }
}

function proxyData(data) {
    if(
        (typeof data!=='object' && typeof data!=='function') ||
        data === null
    ) {
        return data;
    }
    let proxyValue = {}
    return new Proxy(data, {
        get(target, propKey, receiver) {
            if(!proxyValue[propKey]) {
                proxyValue[propKey] = Reflect.get(target, propKey, receiver)
            }
            const propertyDescriptor = Reflect.getOwnPropertyDescriptor(target, propKey)
            if(propertyDescriptor && propertyDescriptor.configurable===false) {
                return proxyValue[propKey]
            }
            return proxyData(proxyValue[propKey]);
        },
        getPrototypeOf(target) {
            return proxyData(Reflect.getPrototypeOf(target));
        },
        getOwnPropertyDescriptor(target, propKey) {
            if(!proxyValue[propKey]) {
                Reflect.getOwnPropertyDescriptor(target, propKey)
            }
            return Reflect.getOwnPropertyDescriptor(proxyValue, propKey)
        },
        set(_target, propKey, value, receiver) {
            return Reflect.set(proxyValue, propKey, value,receiver);
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

export type dynamicRunParamsType = {
    code:string,
    filename:string,
    customContext?:ObjectMap,
    requireDependenceFunc?:Function
}

export function dynamicRun({
    code,filename,customContext={},requireDependenceFunc=()=>{}
}:dynamicRunParamsType) {
    const newRequire:Function = genModuleRequire({
        filename, customContext, requireDependenceFunc
    });
    const newModule:{
        exports:{
            [key:string]:any
        }
    } = {exports:{}}
    const proxyContext = proxyData({
        console,
        setTimeout,
        setInterval,
        clearInterval,
        clearTimeout,
        process,
        Buffer,
        Array,
        Object,
        Function,
        Symbol,
        Promise,
        Set,
        WeakSet,
        Map,
        WeakMap,
        ArrayBuffer,
        DataView,
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        Float32Array,
        Float64Array,
        Proxy,
        ...customContext
    })
    const ctx = {
        require:newRequire,
        module:newModule,
        exports:newModule.exports,
        __filename:filename,
        __dirname:path.dirname(filename),
    }
    const proxyContextKeys = Reflect.ownKeys(proxyContext)
    for(const key of proxyContextKeys) {
        ctx[key] = proxyContext[key]
    }
    const ctxKeys:string[] = Object.keys(ctx)
    const ctxValues:any[] = Object.values(ctx)
    const dynamicFunction = vm.compileFunction(
        code,
        ctxKeys,
        {
            filename:filename,
        }
    )
    // @ts-ignore
    dynamicFunction(...ctxValues)
    return newModule.exports;
}