pipeline {
    agent none
    options {
        ansiColor('xterm')
        timeout(time: 10, unit: 'MINUTES')
        timestamps()
    }
    stages {
        stage('build') {
            agent { label 'master' }
            steps {
                script {
                    GITHUB_API = 'https://api.github.com/repos/brave'
                    PIPELINE_NAME = 'pr-brave-core-crx-packager-pr-test-' + CHANGE_BRANCH.replace('/', '-')

                    withCredentials([usernamePassword(credentialsId: 'brave-builds-github-token-for-pr-builder', usernameVariable: 'PR_BUILDER_USER', passwordVariable: 'PR_BUILDER_TOKEN')]) {
                        def prDetails = readJSON(text: httpRequest(url: GITHUB_API + '/brave-core-crx-packager/pulls?head=brave:' + CHANGE_BRANCH, customHeaders: [[name: 'Authorization', value: 'token ' + PR_BUILDER_TOKEN]]).content)[0]
                        SKIP = prDetails.draft.equals(true) || prDetails.labels.count { label -> label.name.equalsIgnoreCase('CI/skip') }.equals(1)
                    }

                    if (SKIP) {
                        echo "Aborting build as PRs are either in draft or have a skip label (CI/skip)"
                        currentBuild.result = 'ABORTED'
                        return
                    }

                    for (build in Jenkins.instance.getItemByFullName(JOB_NAME).builds) {
                        if (build.isBuilding() && build.getNumber() < BUILD_NUMBER.toInteger()) {
                            echo 'Aborting older running build ' + build
                            build.doStop()
                        }
                    }

                    jobDsl(scriptText: """
                        pipelineJob('${PIPELINE_NAME}') {
                            // this list has to match the parameters in the Jenkinsfile from devops repo
                            parameters {
                                stringParam('BRANCH', '${CHANGE_BRANCH}')
                            }
                            definition {
                                cpsScm {
                                    scm {
                                        git {
                                            remote {
                                                credentials('brave-builds-github-token-for-pr-builder')
                                                github('brave/devops', 'https')
                                            }
                                            branch('master')
                                        }
                                    }
                                    scriptPath("jenkins/jobs/extensions/dev/brave-core-crx-packager-pr-test.Jenkinsfile")
                                }
                            }
                        }
                    """)

                    params = [
                        string(name: 'BRANCH', value: CHANGE_BRANCH)
                    ]

                    currentBuild.result = build(job: PIPELINE_NAME, parameters: params, propagate: false).result
                }
            }
        }
    }
}
