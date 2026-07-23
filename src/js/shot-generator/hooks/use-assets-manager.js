import * as THREE from 'three'
import React, { useState, useMemo, useEffect } from 'react'
import observable from '../../utils/observable'
import { gltfLoader } from '../utils/gltfLoader'

/**
 * Resources storage
 * @type {observable}
 */
export const cache = observable({})

const textureLoader = new THREE.TextureLoader()

const LOADING_MODE = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
}

/**
 * Checks if resource has been loaded
 * @param path Resource path
 * @returns {boolean}
 */
const isLoaded = (path) => {
  const state = cache.get()

  return (state[path] && state[path].status === LOADING_MODE.SUCCESS)
}

/**
 * Checks if asset is loaded or if asset fetching has been started
 * @param path
 * @returns {boolean}
 */
const assetExist = (path) => Boolean(cache.get()[path])

const isAssetPending = (path) => (cache.get()[path] && cache.get()[path].status === LOADING_MODE.PENDING)

const isAssetError = (path) => (cache.get()[path] && cache.get()[path].status === LOADING_MODE.ERROR)

/**
 * Fetches resource
 * @param path Resource path
 * @returns {Promise<null|THREE.Texture|THREE.Object>}
 */
export const loadAsset = (path) => {
  if (!path) {
    return Promise.resolve(null)
  }

  const current = cache.get()

  // (re)start the load if we've never seen this path, or if a previous
  // attempt ended in an error — otherwise a single transient failure (e.g.
  // a file that wasn't finished writing yet) would leave the asset stuck
  // forever, since nothing else ever calls loader.load() for it again
  if (!current[path] || current[path].status === LOADING_MODE.ERROR) {
    cache.set({
      ...cache.get(),
      [path]: {data: null, status: LOADING_MODE.PENDING, usageCount: current[path] ? current[path].usageCount : 0, lastUsedDate: Date.now()}
    })

    return new Promise((resolve, reject) => {
      let loader
      if (!path.match(/(\.(png|jpg|jpeg|gif)$)|((\\|\/)(images|volumes)(\\|\/))/mi)) {
        /** Current resource is model */
        loader = gltfLoader
      } else {
        /** Current resource is texture */
        loader = textureLoader
      }

      loader.load(
        path,
        value => {
          let entry = cache.get()[path]
          cache.set({
            ...cache.get(),
            [path]: {data: value, status: LOADING_MODE.SUCCESS, usageCount: entry.usageCount, lastUsedDate: entry.lastUsedDate }
          })
          resolve(cache.get()[path])
        },
        null, //progress => dispatch({ type: 'PROGRESS', payload: { id, progress } }),
        error => {
          console.error(`[use-assets-manager] failed to load asset: ${path}`, error)
          let entry = cache.get()[path]
          cache.set({
            ...cache.get(),
            [path]: {data: null, status: LOADING_MODE.ERROR, usageCount: entry ? entry.usageCount : 0, lastUsedDate: Date.now()}
          })
          reject(error)
        }
      )
    })
  }

  return Promise.resolve(current[path])
}

export const cleanUpCache = () => {
  cache.set({})
}
/**
 * Hook that allows components to fetch resources
 * @param paths Array of resources paths
 * @returns {{loaded: boolean, assets: Array}}
 */
export const useAssets = (paths) => {
  const [assetsToLoad, setAssetsToLoad] = useState(paths || [])

  const cleanUnusedAssets = () => {
    let keys = Object.keys(cache.get())
    for(let i = 0; i < keys.length; i++) {
      let key = keys[i]
      let currentAsset = cache.get()[key]
      if(currentAsset.usageCount === 0) {
        let difference = (Date.now() - currentAsset.lastUsedDate) / 60000
        if(difference >= 15) {
          delete cache.get()[key]
        }
      }
    }
  } 
  /**
   * Fetch not fetched resources if 'paths' variable was changed
   */
  useEffect(() => {
    const shouldLoad = paths.filter(asset => !assetExist(asset) || isAssetError(asset))
    const pendingAssets = paths.filter(asset => isAssetPending(asset))
    if (shouldLoad.length > 0) {
      shouldLoad.map(loadAsset) // Fetch here
    }

    // Update 'assetsToLoad' to know, how many objects we are waiting for fetch
    setAssetsToLoad(shouldLoad.concat(pendingAssets))
    for(let i = 0; i < paths.length; i++) {
      cache.get()[paths[i]].usageCount += 1
      cache.get()[paths[i]].lastUsedDate = Date.now()
    }
    cleanUnusedAssets()
    return () => {
      for(let i = 0; i < paths.length; i++) {
        let currentModel = cache.get()[paths[i]]
        if(!currentModel) continue
        currentModel.usageCount -= 1
      }
    }
  }, [paths.reduce((acc, v) => acc + v, '')])

  /**
   * Subscribe to cache on mount, remove subscription on unmount
   */
  useEffect(() => {
    if (assetsToLoad.length === 0) {
      // If we don't have assetsToLoad then exit
      return
    }
    
    // Next function is called when some resource has been loaded
    const fn = () => {
      // Get resources that haven't fetched yet
      const toLoadNext = assetsToLoad.filter(asset => !isLoaded(asset))
      
      // If we still have any resources to fetch then update 'assetsToLoad'
      if (toLoadNext.length !== assetsToLoad.length) {
        setAssetsToLoad(toLoadNext)
      }
    }

    cache.subscribe(fn)

    return () => {
      cache.unsubscribe(fn)
    }
  }, [assetsToLoad, paths])

  // This returns our assets
  const assets = useMemo(() => {
    const current = cache.get()

    // Get only loaded assets
    return paths.filter(isLoaded).map((path) => {
      return current[path].data
    })
  }, [assetsToLoad, paths])
  
  return {
    assets, // Array of loaded assets
    loaded: (assetsToLoad.length === 0) // Are assets loaded?
  }
}

/**
 * Hook that allows components to fetch single resource
 * @param path Resources path
 * @returns {{loaded: boolean, asset: THREE.Texture|THREE.Object}}
 */
export const useAsset = (path) => {
  const {assets, loaded} = useAssets(path ? [path] : [])
  
  return {asset: assets[0], loaded}
}
