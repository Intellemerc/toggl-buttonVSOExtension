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

class TogglButtonDialogLauncher {
    constructor(public actionContext: any) {

    }

    launchDialog() {
        var context = this.actionContext;
        var self = this;

        VSS.require(["VSS/Service",
            "TFS/WorkItemTracking/RestClient",
            "TFS/WorkItemTracking/Contracts",
            "VSS/Authentication/Services"],
            function(VSS_Service, TFS_Wit_WebApi, TFS_Wit_Contracts, AuthenticationService) {
                var witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);
                witClient.getWorkItem(context.workItemId, undefined, undefined, TFS_Wit_Contracts.WorkItemExpand.Relations)
                    .then(function(workItem) {
                        VSS.getService("ms.vss-web.dialog-service").then(function(dialogSvc: IHostDialogService) {

                            //The Form!
                            var togglBtnForm: TogglButtonForm;
                            var webContext = VSS.getWebContext();

                            //contribution info
                            var extInfo = VSS.getExtensionContext();
                            var dialogContributionId = extInfo.publisherId + "." + extInfo.extensionId + "." + "TogglButtonForm";

                            var dialogTitle = "Start Timer!";

                            //dialog options
                            var dialogOptions = {
                                title: dialogTitle,
                                width: 500,
                                height: 600,
                                okText: "Start",
                                okCallback: function(result: ITogglFormResponse) {
                                    
                                    console.log('Start tracking time at toggl.com');
                                    $.ajax({
                                        url: './togglButtonForm/startTimer',
                                        method: 'POST',
                                        data: result,
                                        success: function(startTimerData) {
                                            $('li[command="TogglButton"]').find('img').attr('src', 'https://localhost:43000/images/active-16.png')
                                            
                                            var authTokenManager = AuthenticationService.authTokenManager;
                                            authTokenManager.getToken()
                                                .then(function (token){
                                                    var header = authTokenManager.getAuthorizationHeader(token);
                                                    $.ajaxSetup({headers: {'Authorization': header}});
                                                    
                                                    var postData = [{
                                                        'op': 'add',
                                                        'path': '/fields/System.History',
                                                        'value': 'Toggl.com timer started at: ' + new Date().toISOString()
                                                    }];
                                                    
                                                    if (result.nextState){
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
                                                        success: function(data){
                                                            if (console) console.log('History updated successful');
                                                            document.location.reload();
                                                        },
                                                        error: function(error){
                                                            if (console) console.log('Error ' + error.status + ': ' + error.statusText);                                                            
                                                        }
                                                    })
                                                });
                                        },
                                        error: function(err) {
                                            alert('Not possible to start the timer. Error ' + err.status + ': ' + err.statusText);
                                        }
                                    });
                                },
                                getDialogResult: function() {
                                    return togglBtnForm ? togglBtnForm.getFormInputs() : null;
                                }
                            };

                            //set the contribution context, passed into the dialog
                            var contributionContext = {
                                item: context,
                                workItem: workItem
                            };

                            //open dialog, attach form change listeners and ok button anabler listener
                            dialogSvc.openDialog(dialogContributionId, dialogOptions, contributionContext).then(function(dialog: IExternalDialog) {
                                dialog.getContributionInstance("TogglButtonForm").then(function(togglButtonFormInstance: TogglButtonForm) {
                                    togglBtnForm = togglButtonFormInstance;
                                    togglBtnForm.workItem = workItem;
                                    togglBtnForm.webContext = webContext;

                                    togglBtnForm.onFormChanged(function(formInput) {
                                        dialog.updateOkButton(formInput.primaryId > 0);
                                    });

                                    dialog.updateOkButton(true);
                                });
                            });
                        });
                    });
            });
    }
}