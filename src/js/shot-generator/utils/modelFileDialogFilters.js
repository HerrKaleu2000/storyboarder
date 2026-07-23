// Electron `dialog.showOpenDialog` filters for selecting a custom 3D model file.
// Keep in sync with the extensions handled by `convertToGlb`/`importModelFile`.
const MODEL_FILE_DIALOG_FILTERS = [
  { name: '3D Models', extensions: ['glb', 'obj', 'fbx'] }
]

export default MODEL_FILE_DIALOG_FILTERS
