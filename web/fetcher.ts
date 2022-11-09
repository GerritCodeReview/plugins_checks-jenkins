/**
 * @license
 * Copyright (C) 2022 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  Action,
  ActionResult,
  ChangeData,
  CheckResult,
  CheckRun,
  ChecksProvider,
  ResponseCode,
  RunStatus,
} from '@gerritcodereview/typescript-api/checks';
import {PluginApi} from '@gerritcodereview/typescript-api/plugin';

export declare interface Config {
  name: string;
  url: string;
}

export declare interface JenkinsCheckRun {
  actions: JenkinsAction[];
  attempt: number;
  change: number;
  checkDescription: string;
  checkLink: string;
  checkName: string;
  externalId: string;
  finishedTimestamp: string;
  labelName: string;
  patchset: number;
  results: CheckResult[];
  scheduledTimestamp: string;
  startedTimestamp: string;
  status: RunStatus;
  statusDesciption: string;
  statusLink: string;
}

export declare interface JenkinsAction {
  data: string;
  disabled: boolean;
  method: string;
  name: string;
  primary: boolean;
  summary: boolean;
  tooltip: string;
  url: string;
}

export class ChecksFetcher implements ChecksProvider {
  private plugin: PluginApi;

  configs: Config[] | null;

  constructor(pluginApi: PluginApi) {
    this.plugin = pluginApi;
    this.configs = null;
  }

  async fetch(changeData: ChangeData) {
    if (this.configs === null) {
      await this.fetchConfig(changeData)
        .then(result => {
          this.configs = result;
        })
        .catch(reason => {
          throw reason;
        });
    }
    if (this.configs === null) {
      return {
        responseCode: ResponseCode.OK,
        runs: [],
      };
    }
    const checkRuns: CheckRun[] = [];
    for (const jenkins of this.configs) {
      // TODO: Requests to Jenkins should be proxied through the Gerrit backend
      // to avoid CORS requests.
      await this.fetchFromJenkins(
        `${jenkins.url}/gerrit/check-runs?change=${changeData.changeNumber}&patchset=${changeData.patchsetNumber}`
      )
        .then(response => response.json())
        .then(data => {
          data.runs.forEach((run: JenkinsCheckRun) => {
            checkRuns.push(this.convert(run));
          });
        });
    }

    return {
      responseCode: ResponseCode.OK,
      runs: checkRuns,
    };
  }

  fetchConfig(changeData: ChangeData): Promise<Config[]> {
    const pluginName = encodeURIComponent(this.plugin.getPluginName());
    return this.plugin
      .restApi()
      .get<Config[]>(
        `/projects/${encodeURIComponent(changeData.repo)}/${pluginName}~config`
      );
  }

  convert(run: JenkinsCheckRun): CheckRun {
    const convertedRun: CheckRun = {
      attempt: run.attempt,
      change: run.change,
      checkDescription: run.checkDescription,
      checkLink: run.checkLink,
      checkName: run.checkName,
      externalId: run.externalId,
      finishedTimestamp: new Date(run.finishedTimestamp),
      labelName: run.labelName,
      patchset: run.patchset,
      results: run.results,
      scheduledTimestamp: new Date(run.scheduledTimestamp),
      startedTimestamp: new Date(run.startedTimestamp),
      status: run.status,
      statusDescription: run.statusDesciption,
      statusLink: run.statusLink,
    };
    const actions: Action[] = [];
    for (const action of run.actions) {
      actions.push({
        name: action.name,
        tooltip: action.tooltip,
        primary: action.primary,
        summary: action.summary,
        disabled: action.disabled,
        callback: () => this.rerun(action.url),
      });
    }
    convertedRun.actions = actions;
    return convertedRun;
  }

  private fetchFromJenkins(url: string): Promise<Response> {
    const options: RequestInit = {credentials: 'include'};
    return fetch(url, options);
  }

  private rerun(url: string): Promise<ActionResult> {
    return this.fetchFromJenkins(url)
      .then(_ => {
        return {
          message: 'Run triggered.',
          shouldReload: true,
        };
      })
      .catch(e => {
        return {message: `Triggering the run failed: ${e.message}`};
      });
  }
}
