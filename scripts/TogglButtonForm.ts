//---------------------------------------------------------------------
// <copyright file="TogglButtonForm.ts">
//    This code is licensed under the MIT License.
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF 
//    ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED 
//    TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
//    PARTICULAR PURPOSE AND NONINFRINGEMENT.
// </copyright>
// <summary>All logic inside TogglButtonForm</summary>
//---------------------------------------------------------------------

/// <reference path='ref/jquery.d.ts' />
/// <reference path='ref/VSS.d.ts' />
/// <reference path='ref/chosen.d.ts' />

interface ITogglFormResponse {
    activityDescription: string;
    project: string;
    tags: any[];
    apikey: string;
    nextState: string;
}

interface ITogglOpts {
    method: string;
    baseUrl: string;
    token: string;
    crendentials: any;
    onLoad: any;

}

class TogglButtonForm {
    formChangedCallbacks: any[];
    workItem: any;
    webContext: any;
    togglApiTokenKey: string;
    STATE_FIELD: string = "System.State";
    REASON_FIELD: string = "System.Reason";

    constructor(workItem: any) {
        this.webContext = VSS.getWebContext();
        this.workItem = VSS.getConfiguration().workItem;
        this.togglApiTokenKey = this.webContext.user.uniqueName + "_togglAPIKey";
        this.initializeForm();
    }

    initializeForm() {
        var self = this;

        $('#btnRefresh').click(function () {
            self.fetchTogglInformations();
        });

        $('#btnStop').click(function () {
            self.stopCurrentTimer();
        });

        $('#btnDiscard').click(function () {
            self.discardCurrentTimer();
        });

        $('#txtDescription').val("#" + this.workItem.id + ": " + this.workItem.fields["System.Title"]);

        this.loadAPIKey();

        $('#txtAPIKey').on('change', function () {
            self.hideInfosFromToggl();
        });

        if ($('#txtAPIKey').val()) {
            this.fetchTogglInformations();
        }
        else
            this.hideInfosFromToggl();
    };


    setNextState() {
        var nextState = "";
        var currentState = this.workItem.fields[this.STATE_FIELD];
        switch (this.workItem.fields["System.WorkItemType"]) {
            case 'Product Backlog Item':
                if (currentState === "Approved") {
                    nextState = "Committed"
                }
                break;
            case 'User Story':
            case 'Requirement':
                if (currentState === "New") {
                    nextState = "Active";
                }
                break;
            case 'Bug':
                if (currentState === "New") {
                    var reason = this.workItem.fields[this.REASON_FIELD];
                    if (reason === "New" || reason === "Investigation Complete")//Agile
                        nextState = "Active";
                }
                else if (currentState === "Proposed") {
                    nextState = "Active";
                }
                else if (currentState === "Approved") {
                    nextState = "Committed";
                }
                break;
            case 'Task':
                if (currentState === "To Do") {
                    nextState = "In Progress";
                } else if (currentState === "New" || currentState === "Proposed") {
                    nextState = "Active";
                }
                break;
        }

        if (nextState) {
            $('#nextState').html(nextState);
            $('#changeWIState').show();
        }
    }

    hideInfosFromToggl() {
        $('#startTimer').show();
        $('#project').hide();
        $('#tags').hide();
        $('#changeWIState').hide();
        $('#btnRefresh').show();
    }

    showInfosFromToggl() {
        $('#startTimer').show();
        $('#stopTimer').hide();
        $('#project').show();
        $('#tags').show();
        $('#tagsSelect').chosen();
        $('#btnRefresh').hide();

        this.setNextState();
    }

    fetchTogglInformations() {
        var self = this;
        $.ajax({
            url: './togglButtonForm/getUserData',
            data: { apikey: $('#txtAPIKey').val() },
            success: function (data) {
                self.errorMessage(null);
                var currentTimer = null;

                if (data.time_entries) {
                    currentTimer = data.time_entries.find(function (t) { return t.duration < 0; });
                }

                if (currentTimer) {
                    self.showCurrentTimer(currentTimer);
                } else {
                    self.fillTagsInfo(data.tags);
                    self.fillProjectsAndClientsInfo(data.clients, data.projects);
                    self.showInfosFromToggl();
                }
                self.saveAPIKey();
            },
            error: function (data) {
                self.errorMessage(data.status, data.statusText);
            }
        });
    };

    showCurrentTimer(currentTimer: any) {
        $('#startTimer').hide();
        $('#stopTimer').show();
        $('#activeActivityTitle').text(currentTimer.description);
        $('#activeActivityStartTime').text(new Date(currentTimer.start).toLocaleString())
            .attr('data-timeentryid', currentTimer.id);
    };

    stopCurrentTimer() {
        var self = this;

        $.ajax({
            url: './togglButtonForm/stopTimer',
            method: 'PUT',
            data: { timeEntryId: $('#activeActivityStartTime').data('timeentryid'), apikey: $('#txtAPIKey').val() },
            success: function (data) {
                self.addCompletedTime(data.duration);
                self.initializeForm();
            },
            error: function (data) {
                self.errorMessage(data.status, data.statusText);
            }
        });
    };

    discardCurrentTimer() {
        if (!confirm('Do you want to delete this running time entry?'))
            return;

        var self = this;

        $.ajax({
            url: './togglButtonForm/discardTimer',
            method: 'DELETE',
            data: { timeEntryId: $('#activeActivityStartTime').data('timeentryid'), apikey: $('#txtAPIKey').val() },
            success: function (data) {
                alert('Timer stopped, time not logged');
                self.initializeForm();
            },
            error: function (data) {
                self.errorMessage(data.status, data.statusText);
            }
        })
    }

    saveAPIKey() {
        var apiKey = $('#txtAPIKey').val();

        if (localStorage !== undefined) {
            var userName = this.webContext.user.uniqueName;
            var currentKey = localStorage.getItem(this.togglApiTokenKey);

            if ((currentKey === '' || currentKey != apiKey) && confirm("Do you want to store Toggl API Key for future queries?")) {
                localStorage.setItem(this.togglApiTokenKey, apiKey);
            }
        }
    };

    loadAPIKey() {
        if (localStorage !== undefined) {
            var apiKey = localStorage.getItem(this.togglApiTokenKey);
            if (apiKey)
                $('#txtAPIKey').val(apiKey);
        }
    }

    getAPIKey(): string {
        if (localStorage !== undefined) {
            return localStorage.getItem(this.togglApiTokenKey);
        }

        return '';
    }

    errorMessage(status: number = 200, message: string = '') {
        var $errorDiv = $('#error');

        $errorDiv.html('');

        if (status != null && status != 200)
            $('#error').html('<p>Error ' + status + ': ' + message + '</p>')
    }

    fillTagsInfo(tags) {
        var $tagSelect = $('#tagsSelect');
        $tagSelect.find("option[value!='']").remove();

        if (tags) {
            tags.forEach(function (tag) {
                var $option = $('<option>', {
                    value: tag.name,
                    text: tag.name
                });
                $tagSelect.append($option);
            });
        }
    }

    fillProjectsAndClientsInfo(clients, projects) {
        projects = projects.filter(function (project) {
            return project.server_deleted_at == undefined;
        });

        var $projects = $('#projectSelect');
        $projects.find("optGroup").remove();
        //$projects.find("option[value!='']").remove();
        $projects.find("option").remove();

        clients.forEach(function (client) {
            var $optGroup = $('<optGroup>', { label: client.name });
            projects.filter(function (project) {
                return project.cid === client.id;
            }).forEach(function (project) {
                var $opt = $('<option>', {
                    value: project.id,
                    text: project.name
                });
                $optGroup.append($opt);
            });

            $projects.append($optGroup);
        });

        var withoutClients = projects.filter(function (project) {
            return project.cid == undefined;
        });

        if (withoutClients.length > 0) {
            var $optNoClient = $('<optGroup>', { label: 'No client' });

            withoutClients.forEach(function (project) {
                var $opt = $('<option>', {
                    value: project.id,
                    text: project.name
                });
                $optNoClient.append($opt);
            });

            $projects.append($optNoClient);
        }
    };

    getFormInputs(): ITogglFormResponse {
        var $tags = $('#tagsSelect');
        var tags = $tags.val() ? $tags.val().toString() : '';

        return {
            activityDescription: $('#txtDescription').val(),
            project: $('#projectSelect').val(),
            tags: tags,
            apikey: $('#txtAPIKey').val(),
            nextState: $('#chkChangeState').prop('checked') == false ? "" : $('#nextState').html()
        };
    };

    onFormChanged(callback) {
        if (this.formChangedCallbacks) {
            this.formChangedCallbacks.push(callback);
        }

    };

    addCompletedTime(duration: number) {
        var durationInHours = Math.round(duration / 3.6) / 1000;

        var workItemId = this.workItem.id;
        var apiURI = this.webContext.collection.uri + '_apis/wit/workitems/' + this.workItem.id + '?api-version=1.0';

        VSS.require(["VSS/Service",
            "TFS/WorkItemTracking/RestClient",
            "TFS/WorkItemTracking/Contracts",
            "VSS/Authentication/Services"],
            function (VSS_Service, TFS_Wit_WebApi, TFS_Wit_Contracts, AuthenticationService) {
                var witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);
                witClient.getWorkItem(workItemId, undefined, undefined, TFS_Wit_Contracts.WorkItemExpand.Relations)
                    .then(function (workItem) {
                        var completedTime: number = workItem.fields['Microsoft.VSTS.Scheduling.CompletedWork'];

                        if (completedTime)
                            completedTime += durationInHours;
                        else
                            completedTime = durationInHours;

                        completedTime = Math.round(completedTime * 1000) / 1000;

                        var authTokenManager = AuthenticationService.authTokenManager;
                        authTokenManager.getToken()
                            .then(function (token) {
                                var header = authTokenManager.getAuthorizationHeader(token);
                                $.ajaxSetup({ headers: { 'Authorization': header } });

                                var postData = [{
                                    'op': 'add',
                                    'path': '/fields/System.History',
                                    'value': 'Toggl.com timer stopped at: ' + new Date().toISOString() + ', logged: ' + durationInHours + ' hours'
                                },
                                {
                                    'op': 'add',
                                    'path': '/fields/Microsoft.VSTS.Scheduling.CompletedWork',
                                    'value': completedTime
                                }];

                                $.ajax({
                                    type: 'PATCH',
                                    url: apiURI,
                                    contentType: 'application/json-patch+json',
                                    data: JSON.stringify(postData),
                                    success: function (data) {
                                        if (console) console.log('History updated successful');
                                        window.location.reload();
                                    },
                                    error: function (error) {
                                        if (console) console.log('Error ' + error.status + ': ' + error.statusText);
                                    }
                                })
                            });
                    });
            });
    }
}
