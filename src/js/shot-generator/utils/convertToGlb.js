import fs from 'fs-extra'
import path from 'path'
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'

import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'

const gltfExporter = new GLTFExporter()

// Storyboarder only uses custom 3D objects as tracing references in the
// Shot Generator, so materials/textures are intentionally not imported —
// every mesh gets the same plain grey material instead. This also keeps
// conversion fully synchronous (no texture loads to wait on).
const defaultMaterial = new MeshStandardMaterial({ color: 0x808080 })

// Storyboarder's scene renderer pulls meshes out of the loaded glTF
// individually (it re-parents each one under its own object group) and
// ignores whatever transform their original ancestor nodes had — so a scale
// or rotation stored on a parent node (e.g. the FBX unit-scale correction,
// or a source file's own group hierarchy) would silently be dropped. To
// keep imports robust regardless of how the app consumes them, we bake
// every mesh's full world transform directly into its geometry and export
// a flat, single-level scene of identity-transform meshes.
const flattenToWorldSpace = object => {
  object.updateMatrixWorld(true)

  let root = new Group()
  object.traverse(node => {
    if (node.isMesh) {
      let geometry = node.geometry.clone()
      geometry.applyMatrix4(node.matrixWorld)
      root.add(new Mesh(geometry, defaultMaterial))
    }
  })

  return root
}

// OBJ has no unit metadata at all, and FBX's declared UnitScaleFactor turns
// out to be unreliable in practice (free/downloaded FBX assets routinely
// declare a unit that doesn't match how the mesh was actually authored, e.g.
// a file claiming "1 unit = 1 inch" whose geometry is really centimeter- or
// millimeter-scale, producing wildly-off results). Rather than trust
// per-file metadata, every import is normalized to the same predictable
// size: its longest bounding-box dimension becomes exactly 1 meter, matching
// the width/height/depth = 1 convention already used for built-in objects.
// The user can then scale it precisely with the existing inspector controls.
const TARGET_SIZE = 1

const normalizeToTargetSize = object => {
  let size = new Box3().setFromObject(object).getSize(new Vector3())
  let maxDimension = Math.max(size.x, size.y, size.z)

  if (maxDimension > 0 && Number.isFinite(maxDimension)) {
    let scale = TARGET_SIZE / maxDimension
    object.traverse(node => {
      if (node.isMesh) {
        node.geometry.scale(scale, scale, scale)
      }
    })
  }

  return object
}

const exportToGlb = object => new Promise((resolve, reject) => {
  gltfExporter.parse(
    object,
    result => {
      if (result instanceof ArrayBuffer) {
        resolve(Buffer.from(result))
      } else {
        reject(new Error('convertToGlb: expected binary ArrayBuffer output from GLTFExporter'))
      }
    },
    { binary: true }
  )
})

const loadObj = absolutePath => {
  let text = fs.readFileSync(absolutePath, 'utf-8')
  return new OBJLoader().parse(text)
}

const loadFbx = absolutePath => {
  let buffer = fs.readFileSync(absolutePath)
  let arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  return new FBXLoader().parse(arrayBuffer, path.dirname(absolutePath) + path.sep)
}

// convertible source extensions this module currently knows how to handle
const CONVERTIBLE_EXTENSIONS = ['.obj', '.fbx']

const isConvertible = absolutePath =>
  CONVERTIBLE_EXTENSIONS.includes(path.extname(absolutePath).toLowerCase())

// load a non-GLB 3D file and convert it (geometry only) to a binary GLB Buffer
const convertToGlb = async absolutePath => {
  let ext = path.extname(absolutePath).toLowerCase()

  let object
  switch (ext) {
    case '.obj':
      object = loadObj(absolutePath)
      break
    case '.fbx':
      object = loadFbx(absolutePath)
      break
    default:
      throw new Error(`convertToGlb: unsupported file extension "${ext}"`)
  }

  return exportToGlb(normalizeToTargetSize(flattenToWorldSpace(object)))
}

export default convertToGlb
export { isConvertible }
