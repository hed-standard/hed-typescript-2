/**
 * BIDS file accessor for browser environments.
 *
 * Reads dataset files from browser {@link https://developer.mozilla.org/en-US/docs/Web/API/File | File}
 * objects provided via a `<input webkitdirectory>` or drag-and-drop upload.
 *
 * @module bids/webAccessor
 */

import { BidsFileAccessor } from './datasetParser'

/**
 * Process a list of files to determine the dataset root and create a relative file map.
 *
 * @param fileInput - The files from a webkitdirectory upload.
 * @returns The dataset root directory name and the relative file map.
 * @internal
 */
function _processFileList(fileInput: FileList | File[]): { datasetRootDirectory: string; fileMap: Map<string, File> } {
  const fileList = Array.from(fileInput)
  if (fileList.length === 0) {
    return { datasetRootDirectory: '', fileMap: new Map<string, File>() }
  }

  // Find dataset_description.json to determine the root path prefix.
  const descriptionFile = fileList.find((f) => (f.webkitRelativePath || f.name).endsWith('dataset_description.json'))
  let prefix = ''
  if (descriptionFile) {
    const filePath = descriptionFile.webkitRelativePath || descriptionFile.name
    const lastSlashIndex = filePath.lastIndexOf('/')
    if (lastSlashIndex > -1) {
      prefix = filePath.substring(0, lastSlashIndex)
    }
  } else {
    const firstPath = fileList[0]?.webkitRelativePath || ''
    const rootDirEndIndex = firstPath.indexOf('/')
    if (rootDirEndIndex > -1) {
      prefix = firstPath.substring(0, rootDirEndIndex)
    }
  }

  const datasetRootDirectory = prefix
  const fileMap = new Map<string, File>()
  const prefixWithSlash = prefix ? prefix + '/' : ''

  for (const file of fileList) {
    const webkitRelativePath = file.webkitRelativePath || file.name
    if (!webkitRelativePath) continue
    const relativePath = webkitRelativePath.startsWith(prefixWithSlash)
      ? webkitRelativePath.substring(prefixWithSlash.length)
      : webkitRelativePath
    if (relativePath) {
      fileMap.set(relativePath, file)
    }
  }
  return { datasetRootDirectory, fileMap }
}

/**
 * BIDS file accessor for browser environments.
 *
 * Reads file content using the browser {@link https://developer.mozilla.org/en-US/docs/Web/API/File/text | File.text()}
 * API. Schema loading uses remote (HTTPS) fetching.
 *
 * @example
 * const input = document.querySelector('input[webkitdirectory]')
 * const accessor = await BidsWebAccessor.create(input.files)
 * const [dataset, issues] = await BidsDataset.create(accessor, BidsWebAccessor)
 */
export default class BidsWebAccessor extends BidsFileAccessor<File> {
  /**
   * Factory method to create a BidsWebAccessor from a browser FileList.
   *
   * @param fileInput - The files from a webkitdirectory upload.
   * @returns A Promise resolving to the accessor.
   * @override
   */
  public static async create(fileInput: FileList | File[]): Promise<BidsWebAccessor> {
    const { datasetRootDirectory, fileMap } = _processFileList(fileInput)
    return new BidsWebAccessor(datasetRootDirectory, fileMap)
  }

  /**
   * Constructor for BidsWebAccessor.
   *
   * @param datasetRootDirectory - The root directory of the dataset.
   * @param fileMap Map of relative file paths to browser File objects.
   */
  public constructor(datasetRootDirectory: string, fileMap: Map<string, File>) {
    super(datasetRootDirectory, fileMap)
  }

  /**
   * Read a file's content via the browser File API.
   *
   * @param relativePath - The relative path to the file within the dataset.
   * @returns The file contents, or null if not found.
   */
  public async getFileContent(relativePath: string): Promise<string | null> {
    const file = this.fileMap.get(relativePath)
    if (!file) {
      return null
    }
    if (typeof file.text === 'function') {
      return await file.text()
    }
    throw new Error(`Cannot read file ${relativePath}: File object in map lacks .text() method.`)
  }
}
