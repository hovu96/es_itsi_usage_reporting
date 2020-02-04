# ES / ITSI Usage Reporting

![ES / ITSI Usage Reporting](overview.png)

This app allows you to create a simple report on daily ES / ITSI usage in Splunk based on manual index selection. Admin can select which indexes are used for each premium app, and the app will summarize it.

## Requirements
The searches in the dashboard are accessing **_internal** licence_usage logs. The app will only work on a search head which has access to the _internal logs on the **license master**. It also would need to have access to the indexes in order to create a selection list. User has to be assigned to a role with access to the _internal indexes. 


You may check if you see results with following search: 
`index=_internal source=*license_usage.log* type="Usage"`


## Usage

![Configuration](configure.png)

Install the app, use "configure" page to assign indexes used for ES or ITSI. The page will display all indexes on first usage or by clicking "Auto Add Indexes" button. 

"Auto-Add Indexes" will only work, if nothing is selected yet or all indexes removed. So if you want to start over, just remove all and click on "Auto-Add Indexes"

If you prefer not to use the configuration gui you may also manually  add a comma separated list (only comma, no space) to the *"reporting"* stanza in *local/app.conf*:

`[reporting]`

`itsi_indexes = os,os_metrics,db_metrics`

`es_indexes = notable,main,dns`

`core_only_indexes = test,weather`

This app will install an accelerated datamodel "License Usage". License logs are otherwise only kept for the last 30 days.  The constarints of the datamodel are following: 
`index=_internal source="*license_usage.log" sourcetype=splunkd type="Usage"`

Usage log also shows the "default" index. This is by default the same as  "main" or assigned by "defaultDatabase" setting. The index list macro will add it to the corresponding index if the setting exists.  

## Support

This app is not officially supported by Splunk.

## License

[Apache License 2.0](LICENSE.md)
