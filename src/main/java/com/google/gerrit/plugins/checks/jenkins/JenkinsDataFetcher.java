// Copyright (C) 2022 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package com.google.gerrit.plugins.checks.jenkins;

import com.google.common.flogger.FluentLogger;
import com.google.gerrit.entities.Project;
import com.google.gerrit.extensions.annotations.PluginName;
import com.google.gerrit.extensions.restapi.Response;
import com.google.gerrit.extensions.restapi.RestReadView;
import com.google.gerrit.server.config.PluginConfigFactory;
import com.google.gerrit.server.project.NoSuchProjectException;
import com.google.gerrit.server.change.RevisionResource;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.google.gson.Gson;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;
import org.eclipse.jgit.lib.Config;

@Singleton
public class JenkinsDataFetcher implements RestReadView<RevisionResource> {
  private static final FluentLogger logger = FluentLogger.forEnclosingClass();
  private static final Gson gson = new Gson();
  private static final String jenkins_SECTION = "jenkins";
  private static final String jenkins_URL_KEY = "url";
  private static final String jenkins_USER_KEY = "user";
  private static final String jenkins_TOKEN_KEY = "token";

  private final PluginConfigFactory config;
  private final String pluginName;

  @Inject
  JenkinsDataFetcher(PluginConfigFactory config, @PluginName String pluginName) {
    this.config = config;
    this.pluginName = pluginName;
  }

  @Override
  public Response<String> apply(RevisionResource rev) {
    try {
      Set<JenkinsChecksConfig> configs = getConfigs(rev.getProject().get());
      String changeNumber = rev.getChange().getId().toString();
      String patchsetNumber = String.valueOf(rev.getPatchSet().number());

      for (JenkinsChecksConfig config : configs) {
        String url = String.format("%s/gerrit-checks/runs?change=%s&patchset=%s", config.url, changeNumber, patchsetNumber);
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod("GET");
        String auth = config.user + ":" + config.token;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
        connection.setRequestProperty("Authorization", "Basic " + encodedAuth);
        connection.setRequestProperty("Content-Type", "application/json");

        int responseCode = connection.getResponseCode();
        InputStream responseStream = (responseCode == 200) ? connection.getInputStream() : connection.getErrorStream();
        String responseBody = new BufferedReader(new InputStreamReader(responseStream, StandardCharsets.UTF_8))
            .lines().collect(Collectors.joining("\n"));

        //logger.atInfo().log("Received response from Jenkins: %s", responseBody);

        if (responseCode != 200) {
          logger.atSevere().log("Error response from Jenkins: %s", responseBody);
          return Response.withStatusCode(responseCode, responseBody);
        }

        // Ensure the response includes a "runs" array
        if (!responseBody.contains("\"runs\"")) {
          logger.atSevere().log("Invalid response structure: %s", responseBody);
          return Response.withStatusCode(500, "Invalid response structure");
        }

        return Response.ok(responseBody);
      }
    } catch (Exception e) {
      logger.atSevere().withCause(e).log("Error fetching Jenkins data");
      return Response.withStatusCode(500, "Error fetching Jenkins data");
    }
    return Response.ok("No Jenkins configurations found");
  }

  private Set<JenkinsChecksConfig> getConfigs(String projectName) throws NoSuchProjectException {
    Set<JenkinsChecksConfig> result = new HashSet<>();
    Config cfg = config.getProjectPluginConfig(Project.nameKey(projectName), pluginName);
    for (String instance : cfg.getSubsections(jenkins_SECTION)) {
      JenkinsChecksConfig jenkinsCfg = new JenkinsChecksConfig();
      jenkinsCfg.name = instance;
      jenkinsCfg.url = cfg.getString(jenkins_SECTION, instance, jenkins_URL_KEY);
      jenkinsCfg.user = cfg.getString(jenkins_SECTION, instance, jenkins_USER_KEY);
      jenkinsCfg.token = cfg.getString(jenkins_SECTION, instance, jenkins_TOKEN_KEY);
      result.add(jenkinsCfg);
    }
    return result;
  }

  static class JenkinsChecksConfig {
    String name;
    String url;
    String user;
    String token;
  }
}