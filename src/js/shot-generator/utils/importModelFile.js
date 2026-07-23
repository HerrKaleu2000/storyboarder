import path from 'path'
import fs from 'fs-extra'
import log from '../../shared/storyboarder-electron-log'
import ModelLoader from '../../services/model-loader'
import CopyFile from './CopyFile'
import convertToGlb, { isConvertible } from './convertToGlb'

// import a user-selected 3D model file into the project.
// GLB files are copied as-is (existing behavior).
// OBJ/FBX files are converted to GLB first, and the converted file is
// written into the project instead of the original.
// returns a Promise resolving to the relative model path to store on the scene object.
const importModelFile = async (storyboarderFilePath, absolutePath, type) => {
  if (!isConvertible(absolutePath)) {
    return CopyFile(storyboarderFilePath, absolutePath, type)
  }

  log.info(`converting model file to glb: ${absolutePath}`)
  let glbBuffer = await convertToGlb(absolutePath)

  let ext = path.extname(absolutePath)
  let dst = path.join(
    path.dirname(storyboarderFilePath),
    ModelLoader.projectFolder(type),
    `${path.basename(absolutePath, ext)}.glb`
  )

  fs.ensureDirSync(path.dirname(dst))
  fs.writeFileSync(dst, glbBuffer)

  return path.join(
    ModelLoader.projectFolder(type),
    path.basename(dst)
  ).split('\\').join('/')
}

export default importModelFile
