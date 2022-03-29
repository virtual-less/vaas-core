import { readFileSync } from 'fs';
import { createRequire } from 'module';
import * as  path from 'path';
import * as  vm from 'vm';
import * as  os from 'os';

type ObjectMap = {
    [key:string]:any
}

function genModuleRequire({
    filename, vmTimeout, customContext, createRequireFunc
}:{
    filename:string,
    vmTimeout:number,
    customContext:ObjectMap,
    createRequireFunc:Function
}):Function {
    return (moduleId) => {
        const dependenceRequire = createRequireFunc(filename, customContext)
        if(dependenceRequire) {
            const module = dependenceRequire(moduleId)
            if(module) {
                return module
            }
        }
        const newRequire:NodeRequire = createRequire(filename);
        const modulePath = newRequire.resolve(moduleId);
        if(
            moduleId[0]==='.' ||  moduleId[0]==='/'
        ) {
            return dynamicRun({
                code:readFileSync(modulePath).toString(),
                vmTimeout,
                filename:modulePath, 
                customContext, 
                createRequireFunc
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
    vmTimeout?:number,
    customContext?:ObjectMap,
    createRequireFunc?:Function
}

export function dynamicRun({
    code,
    filename,
    vmTimeout=30000,
    customContext = {},
    createRequireFunc=()=>{}
}:dynamicRunParamsType) {
    const newRequire:Function = genModuleRequire({
        filename, vmTimeout, customContext, createRequireFunc
    });
    if(!vm.isContext(customContext)){
        for (const key in customContext) {
            customContext[key] = proxyData(customContext[key])
        }
        vm.createContext(customContext)
    }
    const newModule:{
        exports:ObjectMap
    } = {exports:{}}
    const moduleParams = {
        require:newRequire,
        module:newModule,
        exports:newModule.exports,
        __filename:filename,
        __dirname:path.dirname(filename),
    }
    if(!customContext.moduleData) {customContext.moduleData = {}}
    customContext.moduleData[filename] = moduleParams;
    vm.runInContext(
        `moduleData['${filename}'].moduleFunction = function (
            require,module,exports,__filename,__dirname
        ) {`+os.EOL+
        code
        +os.EOL+`};
        moduleData['${filename}'].moduleFunction(
            moduleData['${filename}'].require,
            moduleData['${filename}'].module,
            moduleData['${filename}'].exports,
            moduleData['${filename}'].__filename,
            moduleData['${filename}'].__dirname
        )`, 
        customContext, {
            filename:filename,
            lineOffset:1,
            timeout:vmTimeout
        }
    )
    return newModule.exports;
}