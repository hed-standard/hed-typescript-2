import { jest } from '@jest/globals'

import type { SchemaSpec } from '../specs'
import * as files from '../../utils/files'

const loaderModule = jest.requireActual<typeof import('../loader')>('../loader')

const specTestLibraries = new Set<string>(['testclash', 'testconflict', 'testminimal'])

export default class MockHedSchemaLoader extends loaderModule.default {
  /**
   * Determine whether this validator bundles a particular schema.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns Whether this validator bundles a particular schema.
   */
  protected override hasBundledSchema(schemaDef: SchemaSpec): boolean {
    return specTestLibraries.has(schemaDef.library) || super.hasBundledSchema(schemaDef)
  }

  /**
   * Retrieve the contents of a bundled schema.
   *
   * @param schemaDef - The description of which schema to use.
   * @returns The raw schema XML data.
   */
  protected override async getBundledSchema(schemaDef: SchemaSpec): Promise<string> {
    if (specTestLibraries.has(schemaDef.library)) {
      return files.readFile(`hedxml/HED_${schemaDef.library}_${schemaDef.version}.xml`)
    } else {
      return super.getBundledSchema(schemaDef)
    }
  }
}
