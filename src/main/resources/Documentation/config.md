Jenkins Checks Configuration
============================

Jenkins servers can be configured for a project by adding a file called
`checks-jenkins.config` to the `refs/meta/config` branch of a project.

File `checks-jenkins.config`
----------------------------

For each Jenkins instance a section with a unique name has to be added.

jenkins.NAME.url
: Base URL of Jenkins including protocol, e.g. https://gerrit-ci.gerritforge.com
