const appName = window.location.pathname.match(/..-..\/app\/(?<app>[^\/]+)/).groups.app;

require([
    "jquery",
    "splunkjs/splunk",
    Splunk.util.make_url(`/static/app/${appName}/utils.js`),
    "splunkjs/ready!"
], function (
    $,
    splunkjs,
    Utils,
    _
) {
    var propertiesEndpoint = Utils.createRestEndpoint("properties");
    var savedEndpoint = Utils.createRestEndpoint("saved");

    const addIndex = function (indexName, value) {
        if (!value) {
            value = "core_only";
        }
        if ($(`splunk-radio-input.index[data-index="${indexName}"]`).length > 0) {
            return;
        }
        const container = $("#index_container");

        const e = $(`
        <splunk-control-group label="${indexName}" help="">
            <splunk-radio-input class="index" data-index="${indexName}" label="" help="" value="${value}">
                <option value="itsi">ITSI</option>
                <option value="es">ES</option>
                <option value="itsi_es">ES &amp; ITSI</option>
                <option value="core_only">Core Only</option>
            </splunk-radio-input>
            <button id="remove-index-${indexName}" class="removeIndex" style="margin-left: 1.8em;" class="btn">Remove</button>
        </splunk-control-group>
        `);

        e.appendTo(container);

        setTimeout(function () {
            const iddd = `#remove-index-${indexName}`;
            $(iddd).click(function () {
                e.remove();
            });
        }, 1);
    };

    const addIndexes = function (indexNames) {
        const itsiInstalled = indexNames.filter(function (indexName) {
            return indexName == "itsi_summary";
        }).length > 0;
        const esInstalled = indexNames.filter(function (indexName) {
            return indexName == "notable";
        }).length > 0;
        var value = "core_only";
        if (itsiInstalled && esInstalled) {
            value = "itsi_es";
        }
        else if (!itsiInstalled && esInstalled) {
            value = "es";
        }
        else if (itsiInstalled && !esInstalled) {
            value = "itsi";
        }
        indexNames.forEach(function (indexName) {
            addIndex(indexName, value);
        });
    };

    const autoAddIndexesBasedOnInternalLog = async function () {
        const results = await Utils.searchAsync(`
        search index=_internal source=*license_usage.log type=usage
        | stats values(idx) as idx
        |append[search earliest=-1h index=_internal source=*license_usage.log type=usage
        | stats  values(idx) as idx]
        |mvexpand idx
        |dedup idx`, {
            "earliest_time": `-30d@d`,
            "latest_time": "now",
            "sample_ratio": "1000",
        });
        const indexNames = results.rows.map(function (row) {
            return row[0];
        })
        addIndexes(indexNames);
    };

    const autoAddIndexesBasedOnRESTCall = async function () {
        const results = await Utils.searchAsync(`
            rest /services/data/indexes count=0
            | search NOT title=_*
            | table title
            | rename title as idx
            | dedup idx`
        );
        const indexNames = results.rows.map(function (row) {
            return row[0];
        })
        addIndexes(indexNames);
    };

    (async function () {
        const progressIndicator = Utils.newLoadingIndicator({
            title: "Loading Settings ...",
            subtitle: "Please wait."
        });
        try {
            const response = await propertiesEndpoint.getAsync('app/reporting', {})

            var settings = response.data.entry.reduce(function (map, obj) {
                map[obj.name] = obj.content;
                return map;
            }, {});

            const esIndexes = settings.es_indexes.split(",").map(function (name) {
                return name.trim();
            }).filter(function (name) {
                return name.length > 0;
            });
            const itsiIndexes = settings.itsi_indexes.split(",").map(function (name) {
                return name.trim();
            }).filter(function (name) {
                return name.length > 0;
            });
            const coreOnlyIndexes = settings.core_only_indexes.split(",").map(function (name) {
                return name.trim();
            }).filter(function (name) {
                return name.length > 0;
            });

            var indexes = {}
            esIndexes.forEach(function (indexName) {
                indexes[indexName] = "es";
            });
            itsiIndexes.forEach(function (indexName) {
                if (indexes[indexName]) {
                    indexes[indexName] = "itsi_es";
                } else {
                    indexes[indexName] = "itsi";
                }
            });
            coreOnlyIndexes.forEach(function (indexName) {
                if (!indexes[indexName]) {
                    indexes[indexName] = "core_only";
                }
            });

            Object.keys(indexes).forEach(function (indexName) {
                const value = indexes[indexName];
                addIndex(indexName, value);
            });

            if (Object.keys(indexes).length == 0) {
                const isConfigured = await propertiesEndpoint.getAsync('app/install/is_configured');
                if (!Utils.normalizeBoolean(isConfigured.data)) {
                    $("#autoAddButton").click();
                }
            }

            const summary_index_name = await propertiesEndpoint.getAsync('macros/summary_index_name/definition');
            $("splunk-text-input[name=\"summary_index_name\"]").attr('value', summary_index_name.data);

            const summarySearch = await savedEndpoint.getAsync('searches/summarize_license_usage');
            const summarySearchEnabled = summarySearch.data.entry[0].content.is_scheduled;
            $("splunk-radio-input[name=\"summary_indexing_enabled\"]").attr('value', summarySearchEnabled ? "1" : "0");

        }
        catch (err) {
            Utils.showErrorDialog(null, err).footer.append($('<button>OK</button>').attr({
                type: 'button',
                class: "btn btn-primary",
            }).on('click', function () {
                window.location.reload();
            }));
        }
        finally {
            progressIndicator.hide();
        }
    })();

    $("#addButton").click(function () {
        const newIndexName = prompt("Please enter index name:");
        if (!newIndexName) return;
        addIndex(newIndexName);
    });

    $("#autoAddButton").click(async function () {

        while (true) {
            const choice = prompt(`There are two ways of determining the list of indexes.\n\n1. Asking the Indexers for the names of indexes currently configured (fast, requires REST permissions & network access to all Indexers).\n\n2. Searching for index names in the internal license usage log (slow, not super-accurate due to event sampling)\n\n Please enter either "rest" or "search".`);

            if (choice == "rest") {
                const progressIndicator = Utils.newLoadingIndicator({
                    title: "Auto-Detecting indexes ('rest' mode) ...",
                    subtitle: "Please wait."
                });
                try {
                    await autoAddIndexesBasedOnRESTCall();
                }
                catch (err) {
                    Utils.showErrorDialog(null, err);
                }
                finally {
                    progressIndicator.hide();
                }
            }
            else if (choice == "search") {
                const progressIndicator = Utils.newLoadingIndicator({
                    title: "Auto-Detecting indexes ('search' mode) ...",
                    subtitle: "Please wait. This may take a couple of minutes."
                });
                try {
                    await autoAddIndexesBasedOnInternalLog();
                }
                catch (err) {
                    Utils.showErrorDialog(null, err);
                }
                finally {
                    progressIndicator.hide();
                }
            }
            else if (!choice || choice == "") {
            } else {
                continue;
            }
            break;
        }
    });

    $("#setupButton").click(async function () {
        const delay = ms => new Promise(res => setTimeout(res, ms));
        const progressIndicator = Utils.newLoadingIndicator({
            title: "Saving Settings ...",
            subtitle: "Please wait."
        });
        try {
            console.log("setting summary index name...");
            await propertiesEndpoint.postAsync('macros/summary_index_name/definition', {
                "value": $("splunk-text-input[name=\"summary_index_name\"]").attr('value')
            });

            const enableSummarySearch = $("splunk-radio-input[name=\"summary_indexing_enabled\"]").attr('value') == "1";
            if (enableSummarySearch) {
                console.log("checking for summary index events...");
                const results = await Utils.searchAsync(
                    "search index=`summary_index_name` search_name=\"summarize_license_usage\" | stats latest(_time) as last_summary | eval no_summaries_in_days = (now() - last_summary) / 60 / 60 / 24 | table no_summaries_in_days", {
                    "earliest_time": `-30@d`,
                    "latest_time": "now",
                });
                var doBackfillHours = 0;
                if (results.rows.length > 0) {
                    console.log("found events in summary index");
                    const noSummariesSinceDays = Math.round(results.rows[0][0] * 100) / 100;
                    if (noSummariesSinceDays > 0.09) {
                        console.log("ask for backfill");
                        if (confirm(`No summaries found for last ${noSummariesSinceDays} days.\n\nDo you want to backfill the summary index now?`)) {
                            doBackfillHours = Math.round(noSummariesSinceDays * 24);
                        } else {
                            console.log("user stopped");
                            return;
                        }
                    }
                } else {
                    console.log("no events in summary index found -> ask for backfill");
                    if (confirm(`No summaries found.\n\nDo you want to backfill the summary index now?`)) {
                        doBackfillHours = 24 * 30;
                    } else {
                        console.log("user stopped");
                        return;
                    }
                }
                if (doBackfillHours > 0) {
                    //TODO: check index exists
                    const backfillProgressIndicator = Utils.newLoadingIndicator({
                        title: "Performing Backfill ...",
                        subtitle: "Please wait."
                    });
                    try {
                        console.log("performing backfill...");
                        await Utils.searchAsync("savedsearch summarize_license_usage", {
                            "earliest_time": `-${doBackfillHours}h@d`,
                            "latest_time": "@h",
                        });
                    } finally {
                        console.log("performing done");
                        backfillProgressIndicator.hide();
                    }
                    console.log("wait for data to appear in summary index...");
                    var found = false;
                    for (var i = 0; i < 120; i++) {
                        await delay(1000);
                        console.log("looking for data...");
                        const searchTestingForData = await Utils.searchAsync(
                            "| datamodel License_Usage License_Usage search | head 1", {
                            "earliest_time": `-30d`,
                            "latest_time": "now",
                        });
                        if (searchTestingForData.rows.length > 0) {
                            console.log("found some data");
                            found = true;
                            break;
                        }
                        console.log("no data found yet");
                    }
                    if (!found) {
                        console.log("no data found after some time -> stop here");
                        alert("Backfill did not work, because no license usage events could not be found in summary index.");
                        return;
                    }
                }
            }

            const esIndexes = $.map($("splunk-radio-input.index").filter(function (_, e) {
                return $(e).attr("value").indexOf("es") >= 0;
            }), function (e) {
                return $(e).attr("data-index");
            });
            await propertiesEndpoint.postAsync('app/reporting/es_indexes', {
                "value": esIndexes.join(",")
            });

            const itsiIndexes = $.map($("splunk-radio-input.index").filter(function (_, e) {
                return $(e).attr("value").indexOf("itsi") >= 0;
            }), function (e) {
                return $(e).attr("data-index");
            });
            await propertiesEndpoint.postAsync('app/reporting/itsi_indexes', {
                "value": itsiIndexes.join(",")
            });

            const coreOnlyIndexes = $.map($("splunk-radio-input.index").filter(function (_, e) {
                return $(e).attr("value") == "core_only";
            }), function (e) {
                return $(e).attr("data-index");
            });
            await propertiesEndpoint.postAsync('app/reporting/core_only_indexes', {
                "value": coreOnlyIndexes.join(",")
            });

            await savedEndpoint.postAsync('searches/summarize_license_usage', {
                "is_scheduled": enableSummarySearch ? 1 : 0
            });

            console.log("searching for licence usage events using data model ...")
            const datamodelTestSearchResults = await Utils.searchAsync(
                "| datamodel License_Usage License_Usage search | head 1", {
                "earliest_time": `-30d`,
                "latest_time": "now",
            });
            console.log(datamodelTestSearchResults);
            if (datamodelTestSearchResults.rows.length == 0) {
                console.log("could not find usage events using data model -> warn user")
                alert("Warning: No results in summary index. Please check index exists and contains events.");
            }

            await propertiesEndpoint.postAsync('app/install/is_configured', {
                "value": "1"
            });
            var appsEndpoint = Utils.createGlobalRestEndpoint("apps");
            await appsEndpoint.postAsync('local/' + appName + '/_reload');
        }
        catch (err) {
            Utils.showErrorDialog(null, err);
        }
        finally {
            progressIndicator.hide();
        }
    });

});