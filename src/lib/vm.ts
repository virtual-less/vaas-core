import { readFileSync } from 'fs'
import { createRequire } from 'module'
import * as path from 'path'
import * as vm from 'vm'
import * as os from 'os'

export interface DynamicRunParamsType {
  filepath: string
  vmTimeout?: number
  extendVer?: NodeJS.Dict<any>
  isGlobalContext?: boolean
  overwriteRequire?: OverwriteRequire
  overwriteReadCodeSync?: OverwriteReadCodeSync
}

export type OverwriteRequire = (callbackData: {
  nativeRequire: NodeRequire
  filepath: string
  moduleId: string
  modulePath: string
}) => any
export type OverwriteReadCodeSync = (filepath: string) => string
interface InnerRunParamsType extends DynamicRunParamsType {
  context: vm.Context
  vmTimeout: number
  overwriteRequire: OverwriteRequire
  overwriteReadCodeSync: OverwriteReadCodeSync
}

function genModuleRequire ({
  filepath, vmTimeout,
  context, isGlobalContext,
  overwriteRequire, overwriteReadCodeSync
}: InnerRunParamsType): Function {
  return (moduleId) => {
    const nativeRequire: NodeRequire = createRequire(filepath)
    const modulePath = nativeRequire.resolve(moduleId)
    const module = overwriteRequire({
      nativeRequire,
      filepath,
      moduleId,
      modulePath
    })
    if (module) { return module }
    return innerRun({
      vmTimeout,
      filepath: modulePath,
      context,
      isGlobalContext,
      overwriteRequire,
      overwriteReadCodeSync
    })
  }
}

export function proxyData<T extends Object> (data: T): T {
  if (
    !(data instanceof Object)
  ) {
    return data
  }
  const proxyValue = {}
  return new Proxy<T>(data, {
    get (target, propKey, receiver) {
      if (!proxyValue[propKey]) {
        proxyValue[propKey] = proxyData(Reflect.get(target, propKey, receiver))
      }
      const propertyDescriptor = Reflect.getOwnPropertyDescriptor(target, propKey)
      if (propertyDescriptor && !propertyDescriptor.configurable) {
        return proxyValue[propKey]
      }
      return proxyValue[propKey]
    },
    getPrototypeOf (target) {
      return proxyData(Reflect.getPrototypeOf(target))
    },
    getOwnPropertyDescriptor (target, propKey) {
      if (!proxyValue[propKey]) {
        Reflect.getOwnPropertyDescriptor(target, propKey)
      }
      return Reflect.getOwnPropertyDescriptor(proxyValue, propKey)
    },
    set (_target, propKey, value, receiver) {
      return Reflect.set(proxyValue, propKey, value, receiver)
    },
    setPrototypeOf (_target, _value) {
      return false
    },
    deleteProperty (_target, propKey) {
      return Reflect.deleteProperty(proxyValue, propKey)
    },
    defineProperty (_target, propKey, propDesc) {
      return Reflect.defineProperty(proxyValue, propKey, propDesc)
    },
    has (target, propKey) {
      return Reflect.has(proxyValue, propKey) || Reflect.has(target, propKey)
    },
    ownKeys (target) {
      return [...new Set([...Object.keys(target), ...Object.keys(proxyValue)]).values()]
    }
  })
}

function innerRun ({
  context,
  filepath,
  isGlobalContext,
  vmTimeout,
  overwriteRequire,
  overwriteReadCodeSync
}: InnerRunParamsType): any {
  if (context.moduleCache[filepath]) {
    return context.moduleCache[filepath]
  }
  const vmModule: {
    exports: NodeJS.Dict<any>
  } = { exports: {} }
  // 为什么要设置moduleCache，原因是解决相互引用死循环问题,且导出变量为默认的exports值
  context.moduleCache[filepath] = vmModule.exports
  const vmRequire: Function = genModuleRequire({
    filepath,
    vmTimeout,
    context,
    isGlobalContext,
    overwriteRequire,
    overwriteReadCodeSync
  })

  const moduleParams = {
    require: vmRequire,
    module: vmModule,
    exports: vmModule.exports,
    __filename: filepath,
    __dirname: path.dirname(filepath),
  }
  const moduleParamsKeys = Object.keys(moduleParams)
  context.moduleData[filepath] = moduleParams
  const vmOption: any = {
    filename: filepath,
    lineOffset: 1
  }
  if (vmTimeout > 0) {
    vmOption.timeout = vmTimeout
  }
  const code = `moduleData['${filepath}'].moduleFunction = function (
        ${moduleParamsKeys.join(',')}
    ) {` + os.EOL +
    overwriteReadCodeSync(filepath) +
    os.EOL + `};
    moduleData['${filepath}'].moduleFunction(
        ${moduleParamsKeys.map(key => `moduleData['${filepath}'].${key}`).join(',')}
    )`
  if (context.isGlobalContext) {
    vm.runInThisContext(code, vmOption)
  } else {
    vm.runInContext(code, context, vmOption)
  }
  // 这里是处理module.exports重新被赋值问题
  context.moduleCache[filepath] = vmModule.exports
  return context.moduleCache[filepath]
}

export function dynamicRun ({
  filepath,
  extendVer = {},
  vmTimeout = 0,
  isGlobalContext = false,
  overwriteRequire = () => {},
  overwriteReadCodeSync = (filepath) => { return readFileSync(filepath).toString() }
}: DynamicRunParamsType): any {
  if (!path.isAbsolute(filepath)) {
    throw new Error('filepath must be absolute path')
  }
  const contextObj = {
    moduleData: {},
    moduleCache: {},
    ...extendVer
  }
  let context
  if (isGlobalContext) {
    context = vm.createContext(Object.assign(globalThis, contextObj))
  } else {
    context = vm.createContext(contextObj)
  }

  return innerRun({
    context,
    isGlobalContext,
    filepath,
    vmTimeout,
    overwriteRequire,
    overwriteReadCodeSync
  })
}
