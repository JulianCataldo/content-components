/* eslint-disable max-lines */
/* eslint-disable arrow-body-style */

import create from 'zustand';
/* ·········································································· */
import type { SaveDTO } from '@astro-content/types/dto';
import type { AppState, Language, Part } from '@astro-content/types/gui-state';
import { $log } from './utils';
/* —————————————————————————————————————————————————————————————————————————— */

const apiBase = '/__content/api';

export async function fetchData() {
  $log('Fetching…');

  const endpointList = ['schemas', 'content', 'errors', 'types', 'config'];

  const data = {};
  await Promise.all(
    endpointList.map(async (key) =>
      fetch(`${apiBase}/${key}`).then((r) =>
        r
          .json()
          .then((j) => {
            data[key] = j;
          })
          .catch((e) => {
            data[key] = {};
            console.log(e);
          }),
      ),
    ),
  );
  return data;
}

function saveUiStateToLocalStorage(val: unknown) {
  localStorage.setItem('uiState', JSON.stringify(val));
}

const useAppStore = create<AppState>()((set) => ({
  uiState: {
    route: { entity: null, entry: null, property: null },
    language: null,
    inspectorPane: 'schema',
    previewPane: 'preview',
  },
  fetchSavedUiState: () => {
    const storage = localStorage.getItem('uiState');
    if (storage) {
      const uiState = JSON.parse(storage) as AppState['uiState'];
      console.log({ fromlocal: uiState });
      set(() => {
        return { uiState };
      });
    }
  },

  /* ········································································ */

  setRoute: (entity: Part, entry: Part, property: Part) => {
    // const newRoute = [route.entity, route.entry, route.property].join('/');
    // window.history.pushState(null, '', `/${newRoute}`);

    set((state) => {
      const newUiState: AppState['uiState'] = {
        ...state.uiState,
        route: { entity, entry, property },
      };
      saveUiStateToLocalStorage(newUiState);
      return { uiState: newUiState };
    });
  },
  setInspectorPane: (name: string) => {
    set((state) => {
      const newUiState: AppState['uiState'] = {
        ...state.uiState,
        inspectorPane: name,
      };
      saveUiStateToLocalStorage(newUiState);
      return { uiState: newUiState };
    });
  },
  setPreviewPane: (name: string) => {
    set((state) => {
      const newUiState: AppState['uiState'] = {
        ...state.uiState,
        previewPane: name,
      };
      saveUiStateToLocalStorage(newUiState);
      return { uiState: newUiState };
    });
  },
  setCurrentLanguage: (id: Language) => {
    console.log({ language: id });
    set((state) => {
      const newUiState: AppState['uiState'] = {
        ...state.uiState,
        language: id,
      };
      saveUiStateToLocalStorage(newUiState);
      return { uiState: newUiState };
    });
  },

  /* ········································································ */

  data: {
    content: null,
    schemas: null,
    errors: null,
    types: null,
    config: null,
  },
  fetchData: async () => {
    const res = await fetchData().catch((_) => null);
    set(() => {
      return { data: res };
    });
  },
  updateContentForValidation: async (
    entity: Part,
    entry: Part,
    property: Part,
    language: Language,
    value: string,
    schema: unknown,
  ) => {
    console.log({
      updateContentForValidation: { entity, entry, property, value, schema },
    });

    const url = [apiBase, '__validate'].join('/');
    const errors = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity,
        entry,
        property,
        language,
        value,
        schema,
      }),
    })
      .then((e) => e.json().then((j) => j as unknown))
      .catch((e) => console.log(e));

    set((state) => {
      const newStateErrors = state.data.errors;
      console.log(newStateErrors);

      newStateErrors[entity][entry][property] = errors.errors;

      return { data: { ...state.data, errors: newStateErrors } };
    });

    // const res = await fetchData().catch((_) => null);
    // set(() => {
    //   return { data: res };
    // });
  },

  /* ········································································ */

  defaultEditor: null,
  setDefaultEditor: (ref) => {
    set(() => {
      return { defaultEditor: ref };
    });
  },

  /* ········································································ */

  save: () => {
    const url = [apiBase, '__save'].join('/');

    set((state) => {
      let value;
      if (state.defaultEditor !== null) {
        value = state.defaultEditor.getValue();
      } else {
        /* Abandon further actions */
        value = 'no';
        return {};
      }

      console.log();
      const language = `.${state.uiState.language ?? ''}`;
      const DTO: SaveDTO = {
        ...state.uiState.route,
        language,
        value,
      };

      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DTO),
      })
        .then((e) => console.log(e))
        .catch((e) => console.log(e));
      return {};
    });
  },
}));

// eslint-disable-next-line import/prefer-default-export
export { useAppStore };
