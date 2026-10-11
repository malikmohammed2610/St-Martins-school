/*
 * St. Martins School
 * Offline Data Manager
 *
 * This replaces a server/database for the no-Node.js version.
 * Data is stored in the browser's localStorage.
 */

(function () {
    "use strict";

    const STORAGE_KEY = "st_martins_offline_data_v1";

    const DEFAULT_DATA = {
        teachers: [],
        admissions: [],
        enquiries: [],
        users: [],
        settings: {}
    };

    // Load all saved data
    function load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (!saved) {
                return clone(DEFAULT_DATA);
            }

            const data = JSON.parse(saved);

            return {
                teachers: Array.isArray(data.teachers) ? data.teachers : [],
                admissions: Array.isArray(data.admissions)
                    ? data.admissions
                    : [],
                enquiries: Array.isArray(data.enquiries)
                    ? data.enquiries
                    : [],
                users: Array.isArray(data.users)
                    ? data.users
                    : [],
                settings: data.settings || {}
            };

        } catch (error) {
            console.error("Unable to load stored data:", error);
            return clone(DEFAULT_DATA);
        }
    }

    // Save all data
    function save(data) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(data)
            );

            return true;

        } catch (error) {
            console.error("Unable to save data:", error);
            return false;
        }
    }

    // Make a copy of an object
    function clone(object) {
        return JSON.parse(JSON.stringify(object));
    }

    // Generate a simple unique ID
    function generateId() {
        return (
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 8)
        );
    }

    // Add a record to a collection
    function add(collection, item) {

        const data = load();

        if (!Array.isArray(data[collection])) {
            data[collection] = [];
        }

        const record = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            ...item
        };

        data[collection].push(record);

        save(data);

        return record;
    }

    // Get all records from a collection
    function get(collection) {
        const data = load();

        if (!Array.isArray(data[collection])) {
            return [];
        }

        return data[collection];
    }

    // Find one record
    function find(collection, callback) {
        const records = get(collection);

        return records.find(callback);
    }

    // Find a record by ID
    function findById(collection, id) {
        return find(
            collection,
            function (record) {
                return record.id === id;
            }
        );
    }

    // Update a record
    function update(collection, id, changes) {

        const data = load();

        if (!Array.isArray(data[collection])) {
            return null;
        }

        const index = data[collection].findIndex(
            function (record) {
                return record.id === id;
            }
        );

        if (index === -1) {
            return null;
        }

        data[collection][index] = {
            ...data[collection][index],
            ...changes,
            updatedAt: new Date().toISOString()
        };

        save(data);

        return data[collection][index];
    }

    // Delete a record
    function remove(collection, id) {

        const data = load();

        if (!Array.isArray(data[collection])) {
            return false;
        }

        const oldLength = data[collection].length;

        data[collection] = data[collection].filter(
            function (record) {
                return record.id !== id;
            }
        );

        save(data);

        return data[collection].length !== oldLength;
    }

    // Clear one collection
    function clearCollection(collection) {

        const data = load();

        data[collection] = [];

        save(data);
    }

    // Clear everything
    function clearAll() {
        localStorage.removeItem(STORAGE_KEY);
    }

    // Export data as JSON
    function exportJSON() {

        const data = load();

        return JSON.stringify(
            data,
            null,
            2
        );
    }

    // Download data as JSON file
    function downloadJSON(filename) {

        filename =
            filename ||
            "st-martins-data.json";

        const json = exportJSON();

        const blob = new Blob(
            [json],
            {
                type: "application/json"
            }
        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }

    // Import JSON data
    function importJSON(json) {

        try {

            const data =
                typeof json === "string"
                    ? JSON.parse(json)
                    : json;

            const finalData = {
                teachers: Array.isArray(data.teachers)
                    ? data.teachers
                    : [],

                admissions: Array.isArray(data.admissions)
                    ? data.admissions
                    : [],

                enquiries: Array.isArray(data.enquiries)
                    ? data.enquiries
                    : [],

                users: Array.isArray(data.users)
                    ? data.users
                    : [],

                settings: data.settings || {}
            };

            save(finalData);

            return true;

        } catch (error) {

            console.error(
                "Unable to import data:",
                error
            );

            return false;
        }
    }

    /*
     * Public API
     *
     * Your HTML pages can use:
     *
     * STMData.get("teachers")
     * STMData.add("teachers", {...})
     * STMData.findById("teachers", id)
     * STMData.update("teachers", id, {...})
     * STMData.remove("teachers", id)
     * STMData.exportJSON()
     * STMData.downloadJSON()
     */

    window.STMData = {

        load: load,
        save: save,

        get: get,
        add: add,

        find: find,
        findById: findById,

        update: update,
        remove: remove,

        clearCollection: clearCollection,
        clearAll: clearAll,

        exportJSON: exportJSON,
        downloadJSON: downloadJSON,

        importJSON: importJSON

    };

})();