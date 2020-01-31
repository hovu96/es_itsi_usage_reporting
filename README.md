# ES / ITSI Usage Reporting

![ES / ITSI Usage Reporting](overview.png)

This app allows you to create a simple report on daily ES / ITSI usage in Splunk based on selected indexes. Admin can select which indexes are used for each premium app, and the app will summarize it.

## Requirements
The searches in the app are using _internal licence_usage logs. The app will only work on a search head which has access to the relevant indexes and to the _intenal logs of the license master. 

You may check if you see results with following: 
index=_internal source=*license_usage.log* type="Usage"


## Usage

![Configuration](configure.png)

Install the app, use "configure" page to assign indexes used for ES or ITSI. The page will display all indexes on first usage or by clicking "Auto Add Indexes" button. 

## Support

This app is not officially supported by Splunk.

## License

[Apache License 2.0](LICENSE.md)
