package com.googlesource.gerrit.plugins.checks.jenkins;

import com.google.common.flogger.FluentLogger;
import com.google.gerrit.entities.Project;
import com.google.gerrit.extensions.annotations.PluginName;
import com.google.gerrit.extensions.restapi.Response;
import com.google.gerrit.extensions.restapi.RestReadView;
import com.google.gerrit.server.config.PluginConfigFactory;
import com.google.gerrit.server.project.NoSuchProjectException;
import com.google.gerrit.server.project.ProjectResource;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.google.gson.Gson;

import java.util.HashSet;
import java.util.Set;
import org.eclipse.jgit.lib.Config;

@Singleton
public class JenkinsConfigFetcher implements RestReadView<ProjectResource> {
  private static final FluentLogger logger = FluentLogger.forEnclosingClass();
  private static final Gson gson = new Gson();
  private static final String jenkins_SECTION = "jenkins";
  private static final String jenkins_URL_KEY = "url";
  private static final String jenkins_TOKEN_KEY = "token";

  private final PluginConfigFactory config;
  private final String pluginName;

  @Inject
  JenkinsConfigFetcher(PluginConfigFactory config, @PluginName String pluginName) {
    this.config = config;
    this.pluginName = pluginName;
  }

  @Override
  public Response<String> apply(ProjectResource project) {
    try {
      Set<JenkinsConfig> configs = getConfigs(project.getName());
      String jsonResponse = gson.toJson(configs);
      return Response.ok(jsonResponse);
    } catch (Exception e) {
      logger.atSevere().withCause(e).log("Error fetching Jenkins config");
      return Response.withStatusCode(500, "Error fetching Jenkins config");
    }
  }

  private Set<JenkinsConfig> getConfigs(String projectName) throws NoSuchProjectException {
    Set<JenkinsConfig> result = new HashSet<>();
    Config cfg = config.getProjectPluginConfig(Project.nameKey(projectName), pluginName);
    for (String instance : cfg.getSubsections(jenkins_SECTION)) {
      JenkinsConfig jenkinsCfg = new JenkinsConfig();
      jenkinsCfg.name = instance;
      jenkinsCfg.url = cfg.getString(jenkins_SECTION, instance, jenkins_URL_KEY);
      jenkinsCfg.token = cfg.getString(jenkins_SECTION, instance, jenkins_TOKEN_KEY);
      result.add(jenkinsCfg);
    }
    return result;
  }

  static class JenkinsConfig {
    String name;
    String url;
    String token;
  }
}