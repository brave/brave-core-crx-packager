pipeline {
    agent none
    options {
        ansiColor('xterm')
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }
    stages {
        stage('build') {
            agent { label 'master' }
            steps {
                script {
                    GITHUB_API = 'https://api.github.com/repos/oajara'

                    withCredentials([usernamePassword(credentialsId: 'oscar-test-up', usernameVariable: 'PR_BUILDER_USER', passwordVariable: 'PR_BUILDER_TOKEN')]) {
                        def prDetails = readJSON(text: httpRequest(url: GITHUB_API + '/brave-core-crx-packager/pulls:' + CHANGE_BRANCH, customHeaders: [[name: 'Authorization', value: 'token ' + PR_BUILDER_TOKEN]]).content)[0]
                        SKIP = prDetails.labels.count { label -> label.name.equalsIgnoreCase('CI/skip') }.equals(1)
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

                    //currentBuild.result = build(job: PIPELINE_NAME, parameters: params, propagate: false).result
                    print("LALA")
                }
            }
        }
    }
}
