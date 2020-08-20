# ES / ITSI Usage Reporting

![ES / ITSI Usage Reporting](overview.png)

This app allows you to create a simple report on daily ES / ITSI usage in Splunk based on manual index selection. Admin can select which indexes are used for each premium app (ES or ITSI), and the app will summarize the license usage for Core, ES and ITSI.

License usage logs are only kept for 30 days by default. In order to report a longer period, we this app creates a scheduled search (hourly) and save the data to a summary index. Summary indexing will also increase the performance of the dashboards.

## Usage

![Configuration](configure.png)

Install the app, use "configure" page to assign indexes used for ES or ITSI. The page will display all indexes on first usage or by clicking "Auto Add Indexes" button.

"Auto-Add Indexes" will only work, if nothing is selected yet or all indexes removed. So if you want to start over, just remove all and click on "Auto-Add Indexes". There are two mode for auto-detection (*rest* and *search*): *Rest* reaches out to indexers and ask for the indexes currently configures, *search* samples indexes appearching in licence usage log, so if you miss any, feel free to add those using "add index" button.

If you prefer not to use the configuration gui you may also manually add a comma separated list (only comma, no space) to the *"reporting"* stanza in *local/app.conf*:

For better performance the app will use a summary index and the data model. If you use a summary index for licensing data already you may change the data model configuration to access your data. You may need to adapt the field names accordingly.  

Scheduled search for the summary index should be enabled. If you change the name ot the summary index, make sure the index really exists.

The name of the scheduled search is *summarize_license_usage* and will run once an hour by default and search the last hour.

Data model is called *License Usage* and can be accelerated if needed. Basically it just refers to the summary index and acts as an abstraction layer if you want to use your existing configuration.

## Support

This app is not officially supported by Splunk and is provided as is.

## License

[Apache License 2.0](LICENSE.md)
