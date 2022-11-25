// @ts-expect-error

import yaml from 'yaml';
import nPath from 'node:path';
import fs from 'node:fs/promises';
import { cloneDeep } from 'lodash-es';
import {
  basicInternalDataValidation,
  fmPattern,
  getFileInfos,
} from './file-loader';
/* ·········································································· */
import type { Module, GenericData, GetFileProps, ValFn } from './types';
import { watchers } from './watcher.js';
import { createHash } from './utils';
/* ========================================================================== */

interface QueryStore {
  module: Module<GenericData>;
  path: string;
}
const queriesCache = new Map<string, QueryStore>();

/* —————————————————————————————————————————————————————————————————————————— */
export async function getFile(
  args: GetFileProps<GenericData>,
): Promise<Module<GenericData> | undefined>;
/* ·········································································· */
export async function getFile<
  Validator extends ValFn<any>,
  AwaitedValidator = Awaited<ReturnType<Validator>>,
>(args: GetFileProps<Validator>): Promise<Module<AwaitedValidator> | undefined>;
/* ·········································································· */
export async function getFile<
  Validator extends ValFn<any>,
  AwaitedValidator = Awaited<ReturnType<Validator>>,
>({
  //
  path,
  markdownTransformers,
  matcherName = undefined,
  matcherGlob = undefined,
  /* This is the trick */
  dataValidator = undefined,
  useCache = true,
  log = false,
}: GetFileProps<Validator>): Promise<
  Module<AwaitedValidator | GenericData> | undefined
> {
  const queryOptions = {
    path,
    dataValidator: dataValidator?.toString(),
    markdownTransformers: markdownTransformers?.toString(),
  };
  const optionsHash = createHash(queryOptions);

  if (useCache && queriesCache.has(optionsHash)) {
    if (log) console.log('Cache hit for ', path);
    return queriesCache.get(optionsHash)!.module;
  }
  if (log) console.log('No cache for ', path);

  let rawFrontmatter: string | undefined;
  let body: string | undefined;

  const result = await fs
    .readFile(nPath.join(process.cwd(), path), 'utf8')
    .then(async (md) => {
      let data: GenericData | undefined;

      const regex = new RegExp(fmPattern, 'm');
      const match = regex.exec(md);

      if (match) {
        const fmWithFences = match[match.length - 1];
        rawFrontmatter = fmWithFences.replace(/^\s+|\s+$/g, '');
        body = md.replace(match[0], '');
      }

      if (rawFrontmatter) {
        try {
          const unknownFm = yaml.parse(rawFrontmatter) as unknown;
          const validData = basicInternalDataValidation(unknownFm);
          if (validData) {
            data = cloneDeep(validData);
          } else {
            console.warn('Invalid incoming data for ', path);
          }
        } catch (e) {
          console.warn(e);
        }
      }
      if (data && dataValidator) {
        try {
          const pathParts = path.split('/');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const infos = { path, pathParts, matcherGlob, matcherName };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data = await dataValidator({ data, ...infos });
          if (data && Object.entries(data).length === 0) {
            data = undefined;
          }
        } catch (e) {
          console.warn(e);
        }
      }
      if (body !== undefined) {
        if (body.trim() === '') {
          body = undefined;
        }
        if (markdownTransformers && body) {
          markdownTransformers.forEach((transformer) => {
            if (typeof body === 'string') {
              body = transformer({ body });
            }
          });
        }
        if (!data && !body) {
          return undefined;
        }
        const module: Module<GenericData> = {
          path,
          data,
          body,
          ...getFileInfos(path),
        };
        queriesCache.set(optionsHash, {
          module,
          path,
        });
        return module;
      }
      return undefined;
    })
    .catch((e) => {
      console.warn(e);
      return undefined;
    });

  return result;
}

watchers.push((file) => {
  queriesCache.forEach((query, key) => {
    if (query.path === file) {
      queriesCache.delete(key);
    }
  });
});
