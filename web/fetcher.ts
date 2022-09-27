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
  Category,
  ChangeData,
  CheckResult,
  CheckRun,
  ChecksProvider,
  FetchResponse,
  LinkIcon,
  ResponseCode,
  RunStatus,
} from '@gerritcodereview/typescript-api/checks';
import {PluginApi} from '@gerritcodereview/typescript-api/plugin';

export declare interface Config {
  name: string;
  url: string;
  jobs: string[];
}

export declare interface Job {
  exists: boolean;
  builds: Build[];
}

export declare interface Build {
  number: number;
  url: string;
}

export declare interface BuildDetail {
  number: number;
  building: boolean;
  result: string;
  url: string;
}

export class ChecksFetcher implements ChecksProvider {
  private plugin: PluginApi;

  configs: Config[] | null;

  constructor(pluginApi: PluginApi) {
    this.plugin = pluginApi;
    this.configs = null;
  }

  async fetch(changeData: ChangeData): Promise<FetchResponse> {
    try {
      return this.innerFetch(changeData);
    } catch (error: unknown) {
      let errorMessage = 'unknown error';
      if (error instanceof Error) errorMessage = error.message;
      if (typeof error === 'string') errorMessage = error;
      console.log(`CHECKSJ return error ${errorMessage}`);
      return {
        responseCode: ResponseCode.ERROR,
        errorMessage,
      };
    }
  }

  async innerFetch(changeData: ChangeData) {
    console.log('CHECKSJ fetch');
    if (this.configs === null) {
      try {
        this.configs = await this.fetchConfig(changeData);
      } catch (error) {
        console.log(`CHECKSJ config fail ${error}`);
        this.configs = this.fallbackConfig();
      }
    }
    if (this.configs === null) {
      console.log('CHECKSJ no config, return empty');
      return {
        responseCode: ResponseCode.OK,
        runs: [],
      };
    }
    const checkRuns: CheckRun[] = [];
    for (const jenkins of this.configs) {
      for (const jenkinsJob of jenkins.jobs) {
        // TODO: Requests to Jenkins should be proxied through the Gerrit backend
        // to avoid CORS requests.
        const job: Job = await this.fetchJobInfo(
          this.buildJobApiUrl(jenkins.url, jenkinsJob, changeData)
        );

        for (const build of job.builds) {
          checkRuns.push(
            this.convert(
              jenkinsJob,
              changeData,
              await this.fetchBuildInfo(this.buildBuildApiUrl(build.url))
            )
          );
        }
      }
    }

    console.log(`CHECKSJ return results ${JSON.stringify(checkRuns)}`);
    return {
      responseCode: ResponseCode.OK,
      runs: checkRuns,
    };
  }

  buildJobApiUrl(
    jenkinsUrl: string,
    jenkinsJob: string,
    changeData: ChangeData
  ) {
    let changeShard: string = changeData.changeNumber.toString().slice(-2);
    if (changeShard.length === 1) {
      changeShard = '0' + changeShard;
    }
    return (
      jenkinsUrl +
      '/job/' +
      jenkinsJob +
      '/job/' +
      changeShard +
      '%252F' +
      changeData.changeNumber.toString() +
      '%252F' +
      changeData.patchsetNumber.toString() +
      '/api/json?tree=builds[number,url]'
    );
  }

  buildBuildApiUrl(baseUrl: string) {
    return baseUrl + 'api/json?tree=number,result,building,url';
  }

  fallbackConfig(): Config[] {
    return [
      {
        url: 'https://gerrit-ci.gerritforge.com',
        name: 'Gerrit CI',
        jobs: ['Gerrit-verifier-pipeline'],
      },
    ];
  }

  fetchConfig(changeData: ChangeData): Promise<Config[]> {
    const pluginName = encodeURIComponent(this.plugin.getPluginName());
    return this.plugin
      .restApi()
      .get<Config[]>(
        `/projects/${encodeURIComponent(changeData.repo)}/${pluginName}~config`
      );
  }

  async fetchJobInfo(url: string): Promise<Job> {
    let response: Response;
    try {
      response = await fetch(url);
      if (!response.ok) throw response.statusText;
    } catch (e) {
      console.log(`CHECKSJ job info exception ${e}`);
      return {
        exists: false,
        builds: [],
      };
    }
    const job: Job = await response.json();
    return job;
  }

  async fetchBuildInfo(url: string): Promise<BuildDetail> {
    let response: Response;
    try {
      response = await fetch(url);
      if (!response.ok) throw response.statusText;
    } catch (e) {
      console.log(`CHECKSJ build info exception ${e}`);
      throw e;
    }
    const build: BuildDetail = await response.json();
    return build;
  }

  convert(
    checkName: string,
    changeData: ChangeData,
    build: BuildDetail
  ): CheckRun {
    let status: RunStatus;
    const results: CheckResult[] = [];

    if (build.result !== null) {
      status = RunStatus.COMPLETED;
      let resultCategory: Category;
      switch (build.result) {
        case 'SUCCESS':
          resultCategory = Category.SUCCESS;
          break;
        case 'FAILURE':
          resultCategory = Category.ERROR;
          break;
        default:
          resultCategory = Category.WARNING;
      }

      const checkResult: CheckResult = {
        category: resultCategory,
        summary: `Result: ${build.result}`,
        links: [
          {
            url: build.url + '/console',
            primary: true,
            icon: LinkIcon.EXTERNAL,
          },
        ],
      };
      results.push(checkResult);
    } else if (build.building) {
      status = RunStatus.RUNNING;
    } else {
      status = RunStatus.RUNNABLE;
    }

    const run: CheckRun = {
      change: changeData.changeNumber,
      patchset: changeData.patchsetNumber,
      attempt: build.number,
      checkName,
      checkLink: build.url,
      status,
      results,
    };
    return run;
  }
}
