const appName = window.location.pathname.match(/..-..\/app\/(?<app>[^\/]+)/).groups.app;

require([
    "jquery",
    "splunkjs/splunk",
    "../../static/app/" + appName + "/utils.js",
    "splunkjs/ready!"
], function (
    $,
    splunkjs,
    Utils,
    _
) {
    var propertiesEndpoint = Utils.createRestEndpoint("properties");

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
            <button class="removeIndex" style="margin-left: 1.8em;" class="btn">Remove</button>
        </splunk-control-group>
        `);

        e.appendTo(container);

        $("button.removeIndex", e).click(function () {
            e.remove();
        });
    };

    const autoAddIndexes = async function () {
        const results = await Utils.searchAsync("eventcount summarize = 0 index =* | fields index | sort - index");
        const indexNames = results.rows.map(function (row) {
            return row[0];
        })
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
        const progressIndicator = Utils.newLoadingIndicator({
            title: "Auto-Detecting ...",
            subtitle: "Please wait."
        });
        try {
            await autoAddIndexes();
        }
        catch (err) {
            Utils.showErrorDialog(null, err);
        }
        finally {
            progressIndicator.hide();
        }
    });

    $("#setupButton").click(async function () {
        const progressIndicator = Utils.newLoadingIndicator({
            title: "Saving Settings ...",
            subtitle: "Please wait."
        });
        try {
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
