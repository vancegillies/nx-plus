export interface ApplicationSchematicSchema {
  name: string;
  tags?: string;
  directory?: string;
  skipFormat: boolean;
  unitTestRunner: 'jest' | 'none';
  e2eTestRunner: 'cypress' | 'none';
}
