import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
  Tree,
  addDependenciesToPackageJson,
} from '@nrwl/devkit';
import { lintProjectGenerator, Linter } from '@nrwl/linter';
import { cypressProjectGenerator, cypressInitGenerator } from '@nrwl/cypress';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import * as path from 'path';
import { ApplicationGeneratorSchema } from './schema';

interface NormalizedSchema extends ApplicationGeneratorSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

function normalizeOptions(
  host: Tree,
  options: ApplicationGeneratorSchema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const projectRoot = `${getWorkspaceLayout(host).appsDir}/${projectDirectory}`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
  };
}

function addFiles(host: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    template: '',
  };
  generateFiles(
    host,
    path.join(__dirname, 'files'),
    options.projectRoot,
    templateOptions
  );
}

function getEslintConfig(options: NormalizedSchema) {
  const eslintConfig = {
    extends: [
      `${offsetFromRoot(options.projectRoot)}.eslintrc.json`,
      `plugin:vue/vue3-essential`,
      'eslint:recommended',
      '@vue/typescript/recommended',
      '@vue/prettier',
      '@vue/prettier/@typescript-eslint',
    ],
    rules: {},
    env: {
      node: true,
    },
  };

  // if (options.unitTestRunner === 'jest') {
  //   eslintConfig.overrides = [
  //     {
  //       files: ['**/*.spec.{j,t}s?(x)'],
  //       env: {
  //         jest: true,
  //       },
  //     },
  //   ];
  // }

  return eslintConfig;
}

async function addEsLint(tree: Tree, options: NormalizedSchema) {
  const lintTask = await lintProjectGenerator(tree, {
    linter: Linter.EsLint,
    project: options.projectName,
    eslintFilePatterns: [`${options.projectRoot}/**/*.{ts,tsx,vue}`],
    skipFormat: true,
  });

  const content = JSON.stringify(getEslintConfig(options));
  const configPath = `${options.projectRoot}/.eslintrc.json`;
  const newConfigPath = configPath.slice(0, -2);
  tree.rename(configPath, newConfigPath);
  tree.write(newConfigPath, `module.exports = ${content};`);

  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@vue/eslint-config-prettier': '6.0.0',
      '@vue/eslint-config-typescript': '^5.0.2',
      'eslint-plugin-prettier': '^3.1.3',
      'eslint-plugin-vue': '^7.0.0-0',
    }
  );

  return [lintTask, installTask];
}

async function addCypress(tree: Tree, options: NormalizedSchema) {
  const cypressInitTask = await cypressInitGenerator(tree);
  const cypressTask = await cypressProjectGenerator(tree, {
    project: options.projectName,
    name: options.name + '-e2e',
    directory: options.directory,
    linter: Linter.EsLint,
    js: false,
  });

  const appSpecPath = options.projectRoot + '-e2e/src/integration/app.spec.ts';
  tree.write(
    appSpecPath,
    tree
      .read(appSpecPath)
      .toString('utf-8')
      .replace(
        `Welcome to ${options.projectName}!`,
        'Hello Vue 3 + TypeScript + Vite'
      )
  );

  return [cypressInitTask, cypressTask];
}

export default async function (
  host: Tree,
  options: ApplicationGeneratorSchema
) {
  const normalizedOptions = normalizeOptions(host, options);
  addProjectConfiguration(host, normalizedOptions.projectName, {
    root: normalizedOptions.projectRoot,
    projectType: 'application',
    sourceRoot: `${normalizedOptions.projectRoot}/src`,
    targets: {
      build: {
        executor: '@nx-plus/vue:vite-build',
        options: {
          viteConfig: `${normalizedOptions.projectRoot}/vite.config.ts`,
        },
      },
      serve: {
        executor: '@nx-plus/vite:vite-serve',
        options: {
          viteConfig: `${normalizedOptions.projectRoot}/vite.config.ts`,
        },
      },
    },
    tags: normalizedOptions.parsedTags,
  });
  addFiles(host, normalizedOptions);
  const lintTasks = await addEsLint(host, normalizedOptions);
  const cypressTasks = await addCypress(host, normalizedOptions);
  const installTask = addDependenciesToPackageJson(
    host,
    { vue: '^3.0.5' },
    {
      '@vitejs/plugin-vue': '^1.1.5',
      '@vue/compiler-sfc': '^3.0.5',
      typescript: '^4.1.3',
      vite: '^2.0.5',
    }
  );
  await formatFiles(host);

  return runTasksInSerial(...lintTasks, ...cypressTasks, installTask);
}
