import path from 'node:path'

import { jest } from '@jest/globals'

import type { SchemaSpec } from '../specs'
import * as files from '../../utils/files'

const loaderModule = jest.requireActual<typeof import('../loader')>('../loader')

const bundledStandard = new Set<string>(['HED8.4.0', 'HED8.5.0'])
const specTestLibraries = new Set<string>(['testclash', 'testconflict', 'testminimal'])

export default class MockHedSchemaLoader extends loaderModule.default {
  /**
   * Determine whether this validator bundles a particular schema.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns Whether this validator bundles a particular schema.
   */
  protected override hasBundledSchema(schemaDef: SchemaSpec): boolean {
    return (
      specTestLibraries.has(schemaDef.library) ||
      bundledStandard.has(schemaDef.localName) ||
      super.hasBundledSchema(schemaDef)
    )
  }

  /**
   * Retrieve the contents of a bundled schema.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns The raw schema XML data.
   */
  protected override async getBundledSchema(schemaDef: SchemaSpec): Promise<string> {
    if (specTestLibraries.has(schemaDef.library) || bundledStandard.has(schemaDef.localName)) {
      return files.readFile(path.join(__dirname, `../../../spec_tests/hedxml/${schemaDef.localName}.xml`))
    } else {
      return super.getBundledSchema(schemaDef)
    }
  }
}
