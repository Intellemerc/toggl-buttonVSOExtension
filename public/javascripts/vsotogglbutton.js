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
var TogglButtonForm = (function () {
    function TogglButtonForm(workItem) {
        this.STATE_FIELD = "System.State";
        this.REASON_FIELD = "System.Reason";
        this.webContext = VSS.getWebContext();
        this.workItem = VSS.getConfiguration().workItem;
        this.togglApiTokenKey = this.webContext.user.uniqueName + "_togglAPIKey";
        this.initializeForm();
    }
    TogglButtonForm.prototype.initializeForm = function () {
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
    ;
    TogglButtonForm.prototype.setNextState = function () {
        var nextState = "";
        var currentState = this.workItem.fields[this.STATE_FIELD];
        switch (this.workItem.fields["System.WorkItemType"]) {
            case 'Product Backlog Item':
                if (currentState === "Approved") {
                    nextState = "Committed";
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
                    if (reason === "New" || reason === "Investigation Complete")
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
                }
                else if (currentState === "New" || currentState === "Proposed") {
                    nextState = "Active";
                }
                break;
        }
        if (nextState) {
            $('#nextState').html(nextState);
            $('#changeWIState').show();
        }
    };
    TogglButtonForm.prototype.hideInfosFromToggl = function () {
        $('#startTimer').show();
        $('#project').hide();
        $('#tags').hide();
        $('#changeWIState').hide();
        $('#btnRefresh').show();
    };
    TogglButtonForm.prototype.showInfosFromToggl = function () {
        $('#startTimer').show();
        $('#stopTimer').hide();
        $('#project').show();
        $('#tags').show();
        $('#tagsSelect').chosen();
        $('#btnRefresh').hide();
        this.setNextState();
    };
    TogglButtonForm.prototype.fetchTogglInformations = function () {
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
                }
                else {
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
    ;
    TogglButtonForm.prototype.showCurrentTimer = function (currentTimer) {
        $('#startTimer').hide();
        $('#stopTimer').show();
        $('#activeActivityTitle').text(currentTimer.description);
        $('#activeActivityStartTime').text(new Date(currentTimer.start).toLocaleString())
            .attr('data-timeentryid', currentTimer.id);
    };
    ;
    TogglButtonForm.prototype.stopCurrentTimer = function () {
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
    ;
    TogglButtonForm.prototype.discardCurrentTimer = function () {
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
        });
    };
    TogglButtonForm.prototype.saveAPIKey = function () {
        var apiKey = $('#txtAPIKey').val();
        if (localStorage !== undefined) {
            var userName = this.webContext.user.uniqueName;
            var currentKey = localStorage.getItem(this.togglApiTokenKey);
            if ((currentKey === '' || currentKey != apiKey) && confirm("Do you want to store Toggl API Key for future queries?")) {
                localStorage.setItem(this.togglApiTokenKey, apiKey);
            }
        }
    };
    ;
    TogglButtonForm.prototype.loadAPIKey = function () {
        if (localStorage !== undefined) {
            var apiKey = localStorage.getItem(this.togglApiTokenKey);
            if (apiKey)
                $('#txtAPIKey').val(apiKey);
        }
    };
    TogglButtonForm.prototype.getAPIKey = function () {
        if (localStorage !== undefined) {
            return localStorage.getItem(this.togglApiTokenKey);
        }
        return '';
    };
    TogglButtonForm.prototype.errorMessage = function (status, message) {
        if (status === void 0) { status = 200; }
        if (message === void 0) { message = ''; }
        var $errorDiv = $('#error');
        $errorDiv.html('');
        if (status != null && status != 200)
            $('#error').html('<p>Error ' + status + ': ' + message + '</p>');
    };
    TogglButtonForm.prototype.fillTagsInfo = function (tags) {
        var $tagSelect = $('#tagsSelect');
        $tagSelect.find("option[value!='']").remove();
        tags.forEach(function (tag) {
            var $option = $('<option>', {
                value: tag.name,
                text: tag.name
            });
            $tagSelect.append($option);
        });
    };
    TogglButtonForm.prototype.fillProjectsAndClientsInfo = function (clients, projects) {
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
    ;
    TogglButtonForm.prototype.getFormInputs = function () {
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
    ;
    TogglButtonForm.prototype.onFormChanged = function (callback) {
        if (this.formChangedCallbacks) {
            this.formChangedCallbacks.push(callback);
        }
    };
    ;
    TogglButtonForm.prototype.addCompletedTime = function (duration) {
        var durationInHours = Math.round(duration / 3.6) / 1000;
        var workItemId = this.workItem.id;
        var apiURI = this.webContext.collection.uri + '_apis/wit/workitems/' + this.workItem.id + '?api-version=1.0';
        VSS.require(["VSS/Service",
            "TFS/WorkItemTracking/RestClient",
            "TFS/WorkItemTracking/Contracts",
            "VSS/Authentication/Services"], function (VSS_Service, TFS_Wit_WebApi, TFS_Wit_Contracts, AuthenticationService) {
            var witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);
            witClient.getWorkItem(workItemId, undefined, undefined, TFS_Wit_Contracts.WorkItemExpand.Relations)
                .then(function (workItem) {
                var completedTime = workItem.fields['Microsoft.VSTS.Scheduling.CompletedWork'];
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
                            if (console)
                                console.log('History updated successful');
                            window.location.reload(true);
                        },
                        error: function (error) {
                            if (console)
                                console.log('Error ' + error.status + ': ' + error.statusText);
                        }
                    });
                });
            });
        });
    };
    return TogglButtonForm;
})();
//---------------------------------------------------------------------
// <copyright file="TogglButtonLauncher.ts">
//    This code is licensed under the MIT License.
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF 
//    ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED 
//    TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
//    PARTICULAR PURPOSE AND NONINFRINGEMENT.
// </copyright>
// <summary>Launcher for TogglButton Extension. Handles dialog options</summary>
//---------------------------------------------------------------------
/// <reference path='ref/jquery.d.ts' />
/// <reference path='ref/VSS.d.ts' />
/// <reference path='TogglButtonForm.ts' />
var TogglButtonDialogLauncher = (function () {
    function TogglButtonDialogLauncher(actionContext) {
        this.actionContext = actionContext;
    }
    TogglButtonDialogLauncher.prototype.launchDialog = function () {
        var context = this.actionContext;
        var self = this;
        VSS.require(["VSS/Service",
            "TFS/WorkItemTracking/RestClient",
            "TFS/WorkItemTracking/Contracts",
            "VSS/Authentication/Services"], function (VSS_Service, TFS_Wit_WebApi, TFS_Wit_Contracts, AuthenticationService) {
            var witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);
            witClient.getWorkItem(context.workItemId, undefined, undefined, TFS_Wit_Contracts.WorkItemExpand.Relations)
                .then(function (workItem) {
                VSS.getService("ms.vss-web.dialog-service").then(function (dialogSvc) {
                    //The Form!
                    var togglBtnForm;
                    var webContext = VSS.getWebContext();
                    //contribution info
                    var extInfo = VSS.getExtensionContext();
                    var dialogContributionId = extInfo.publisherId + "." + extInfo.extensionId + "." + "TogglButtonForm";
                    var dialogTitle = "Start Timer!";
                    //dialog options
                    var dialogOptions = {
                        title: dialogTitle,
                        width: 400,
                        height: 400,
                        okText: "Start",
                        okCallback: function (result) {
                            console.log('Start tracking time at toggl.com');
                            $.ajax({
                                url: './togglButtonForm/startTimer',
                                method: 'POST',
                                data: result,
                                success: function (startTimerData) {
                                    $('li[command="TogglButton"]').find('img').attr('src', 'https://localhost:43000/images/active-16.png');
                                    var authTokenManager = AuthenticationService.authTokenManager;
                                    authTokenManager.getToken()
                                        .then(function (token) {
                                        var header = authTokenManager.getAuthorizationHeader(token);
                                        $.ajaxSetup({ headers: { 'Authorization': header } });
                                        var postData = [{
                                                'op': 'add',
                                                'path': '/fields/System.History',
                                                'value': 'Toggl.com timer started at: ' + new Date().toISOString()
                                            }];
                                        if (result.nextState) {
                                            postData = postData.concat([{
                                                    'op': 'add',
                                                    'path': '/fields/System.State',
                                                    'value': result.nextState
                                                }]);
                                        }
                                        var apiURI = webContext.collection.uri + '_apis/wit/workitems/' + workItem.id + '?api-version=1.0';
                                        $.ajax({
                                            type: 'PATCH',
                                            url: apiURI,
                                            contentType: 'application/json-patch+json',
                                            data: JSON.stringify(postData),
                                            success: function (data) {
                                                if (console)
                                                    console.log('History updated successful');
                                                window.location.reload(true);
                                            },
                                            error: function (error) {
                                                if (console)
                                                    console.log('Error ' + error.status + ': ' + error.statusText);
                                            }
                                        });
                                    });
                                },
                                error: function (err) {
                                    alert('Not possible to start the timer. Error ' + err.status + ': ' + err.statusText);
                                }
                            });
                        },
                        getDialogResult: function () {
                            return togglBtnForm ? togglBtnForm.getFormInputs() : null;
                        }
                    };
                    //set the contribution context, passed into the dialog
                    var contributionContext = {
                        item: context,
                        workItem: workItem
                    };
                    //open dialog, attach form change listeners and ok button anabler listener
                    dialogSvc.openDialog(dialogContributionId, dialogOptions, contributionContext).then(function (dialog) {
                        dialog.getContributionInstance("TogglButtonForm").then(function (togglButtonFormInstance) {
                            togglBtnForm = togglButtonFormInstance;
                            togglBtnForm.workItem = workItem;
                            togglBtnForm.webContext = webContext;
                            togglBtnForm.onFormChanged(function (formInput) {
                                dialog.updateOkButton(formInput.primaryId > 0);
                            });
                            dialog.updateOkButton(true);
                        });
                    });
                });
            });
        });
    };
    return TogglButtonDialogLauncher;
})();
/// <reference path='ref/jquery.d.ts' />
/// <reference path='ref/VSS.d.ts' />
/// <reference path='TogglButtonLauncher.ts' />
//---------------------------------------------------------------------
// <copyright file="app.ts">
//    This code is licensed under the MIT License.
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF 
//    ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED 
//    TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
//    PARTICULAR PURPOSE AND NONINFRINGEMENT.
// </copyright>
// <summary>The "main" method of extension, handle extension call and lauch the dialog.</summary>
//---------------------------------------------------------------------
VSS.init({
    usePlatformScripts: true,
    usePlatformStyles: true
});
var togglButtonHandler = (function () {
    "use strict";
    return {
        execute: function (actionContext) {
            var launcher = new TogglButtonDialogLauncher(actionContext);
            launcher.launchDialog();
        }
    };
}());
VSS.register("TogglButton", togglButtonHandler);
//# sourceMappingURL=vsotogglbutton.js.map