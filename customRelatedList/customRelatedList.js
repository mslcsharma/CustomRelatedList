import { LightningElement, wire, api, track } from "lwc";
import { getRelatedListInfo, getRelatedListRecords } from "lightning/uiRelatedListApi";
import { NavigationMixin } from "lightning/navigation";
import { updateRecord } from "lightning/uiRecordApi";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";
import { getObjectInfo } from "lightning/uiObjectInfoApi";


export default class CustomRelatedList extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName;
    @api iconName;
    @api relatedListTitle;
    @api notesRelatedList;
    @api noteObjectApiName;
    @api sortedBy;
    @api sortDirection;
    @api showNewButton;
    @api pNotesFields;
    @track dataTableColumns; // Datatable columns
    currentPageData = [];
    notesFields;
    notes;
    wiredNotesResult;
    relatedListColumns; 
    dataTable;
    
    dataTableColumnsMap;
    relatedListFields;
    draftValues = [];
    showLoading = true;
    unsupportedListview = false;
    data = [];
    showEditModal = false;
    fieldApiNames;
    fieldsToEdit = [];
    connectedCallback() {
        this.notesFields = this.pNotesFields.split(",").map((x) => this.noteObjectApiName + '.' + x.trim()); 
    }
    @wire(getObjectInfo, { objectApiName: "$noteObjectApiName" })
    objectInfo({ error, data }) {
        if(data){
            var fields = data.fields;
            var fieldProvided = this.pNotesFields.split(",").map((x) => x.trim()); 
            var fieldsToEdit = [];
            fieldProvided.forEach((fieldName) => {
                if(fields[fieldName]?.updateable){
                    fieldsToEdit.push(fieldName);
                }
            });
           if(this.dataTableColumns){
                this.dataTableColumns.forEach((col) => {
                    if(fields[col.fieldName]?.updateable)
                        this.dataTableColumnsMap['editable'] = true;
                    else    
                        this.dataTableColumnsMap['editable'] = false;
                });
            }
            this.fieldsToEdit = fieldsToEdit;
        }else if (error) {
            console.error(JSON.stringify(error, null, 2));
        }
    }
    @wire(getRelatedListInfo, {
        parentObjectApiName: "$objectApiName",
        relatedListId: "$notesRelatedList",
        optionalFields: "$notesFields",
        restrictColumnsToLayout: false
    })
    wiredListInfo({ error, data }) {
        if (data) {
            this.relatedListColumns = data.displayColumns;
            this.relatedListTitle = data.label;
            // To sort the columns based on the order of fields added.
            // Create Map of Column Name to Column.
            let columnMap = {};
            this.relatedListColumns.forEach((col) => {
                columnMap[col.fieldApiName] = col;
            });
            let columns = [];
            let listOfFields = this.pNotesFields.split(",").map((field) => field.trim());
            listOfFields.forEach((field) => {
                if (columnMap[field]) columns.push(columnMap[field]);
            });
            //End Sorting

            // preparing the columns for the datatable
            this.dataTableColumns = columns.map((col) => this.prepareDatatableColumn(col));
            this.dataTableColumnsMap = {};
            this.dataTableColumns.forEach((col) => {
                this.dataTableColumnsMap[col.fieldName] = col;
            });
            this.fieldApiNames = this.relatedListColumns.map((col) => col.fieldApiName);
            this.relatedListFields = this.fieldApiNames.map((col) => this.noteObjectApiName + "." + col);
            
        } else if (error) {
            console.error(JSON.stringify(error, null, 2));
            this.showLoading = false;
            this.unsupportedListview = true;
        }
    }

    prepareDatatableColumn(col) {
        let x = {
            label: col.label,
            fieldName: col.fieldApiName,
            sortable: col.sortable,
            type: col.dataType

        };
        if(this.fieldsToEdit){
            x.editable = this.fieldsToEdit.includes(col.fieldApiName);
        }
        if (this.isUrlCol(col)) {
            x.type = "url";
            x.typeAttributes = {
                label: { fieldName: x.fieldName }
            };
            x.fieldName = col.lookupId + "_URL";
        }else if(col.dataType == 'boolean'){
            x.type = "text";
        }
        return x;
    }

    isUrlCol(col) {
        return col.dataType === "string" && col.lookupId !== null;
    }

    handleSort(event) {
        this.showLoading = true;
        this.sortedBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
    }

    get sortBy() {
        let x = this.noteObjectApiName + ".";
        let z = this.dataTableColumnsMap ? this.dataTableColumnsMap[this.sortedBy] : null;
        x = z && z.type === "url" ? x + z.typeAttributes.label.fieldName : x + this.sortedBy;
        let y = this.sortDirection === "asc" ? x : "-" + x;
        return [y];
    }

    get sortedByFieldLabel() {
        let z = this.dataTableColumnsMap ? this.dataTableColumnsMap[this.sortedBy] : null;
        return z ? z.label : "";
    }

    prepareNote(record) {
        let note = {};
        function getLookupObjectName(column) {
            return column.fieldApiName.split(".")[0];
        }
        try {
            this.relatedListColumns.forEach((col) => {
            let field = col.fieldApiName;
                if (this.isUrlCol(col)) {
                    note[field] = field in record.fields ? record.fields[field].value : record.fields[getLookupObjectName(col)].displayValue;
                    note[col.lookupId + "_URL"] = "/" + record.fields[getLookupObjectName(col)].value.id;
                } else {
                    let v = record.fields[field].displayValue != null ? record.fields[field].displayValue : record.fields[field].value;
                    note[field] = v;
                }
            });
        } catch (error) {
            console.error(error);
        }
        
        note.Id = record.id;
        note.Id_URL = "/" + record.id;
        return note;
    }

    @wire(getRelatedListRecords, {
        parentRecordId: "$recordId",
        relatedListId: "$notesRelatedList",
        fields: "$relatedListFields",
        sortBy: "$sortBy"
    })
    wiredNotes(result) {
        if (!this.relatedListFields) {
            return;
        }
        this.wiredNotesResult = result;
        const { error, data } = result;
        if (data) {
            let x = [];
            data.records.forEach((record) => {
                x.push(this.prepareNote(record));
            });
            this.notes = x;
            this.data = x;
            this.showLoading = false;
        } else if (error) {
            console.error(JSON.stringify(error));
            this.notes = [];
            this.data = [];
            this.showLoading = false;
        }
    }

    get recordCount() {
        return this.notes ? this.notes.length : 0;
    }

    get showEmptyMessage() {
        return !this.showLoading && this.recordCount == 0;
    }

    get showListMeta() {
        return this.recordCount > 1;
    }

    get relatedListTitleWithCount() {
        return this.relatedListTitle + " (" + this.recordCount + ")";
    }

    

    navigateToNewRecordPage() {
        try {
            this[NavigationMixin.Navigate]({
                type: "standard__objectPage",
                attributes: {
                    objectApiName: this.noteObjectApiName,
                    actionName: "new"
                },
                state: {
                    nooverride: "1",
                    navigationLocation: "RELATED_LIST"
                }
            });
        } catch (error) {
            console.error(error);
        }
    }
    async saveRecords(event){
        var el = this.template.querySelector('lightning-datatable');
        var selected = el.getSelectedRows();
        
        let fieldDetails = event.detail.fields;
        let fieldsToEdit = this.fieldsToEdit;
        let records = [];
        selected.forEach((rec) => {
            let recToUpdate = {fields:{Id:rec.Id}};
            fieldsToEdit.forEach((fieldName) => {
                if(fieldDetails[fieldName] != null){
                    recToUpdate.fields[fieldName] = fieldDetails[fieldName];
                }
            });
            records.push(recToUpdate);
        });
        this.updateRecords(records);
        this.showEditModal = false;
    }
    async handleSave(event){
        const records = event.detail.draftValues.slice().map((draftValue) => {
        const fields = Object.assign({}, draftValue);
        return { fields };
        });
        // Clear all datatable draft values
        this.draftValues = [];
        this.updateRecords(records);
        
    }
    async updateRecords(records){
        try {
            // Update all records in parallel thanks to the UI API
            const recordUpdatePromises = records.map((record) => updateRecord(record));
            await Promise.all(recordUpdatePromises);

            // Report success with a toast
            this.dispatchEvent(
                new ShowToastEvent({
                title: "Success",
                message: "Records updated",
                variant: "success",
                }),
            );

            // Display fresh data in the datatable
            await refreshApex(this.wiredNotesResult);
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                title: "Error updating or reloading records",
                message: error?.body?.message,
                variant: "error",
                }),
            );
        }
    }
    handleUpdate(){
        var el = this.template.querySelector('lightning-datatable');
        var selected = el.getSelectedRows();
        if(selected == undefined || selected.length == 0){
            this.dispatchEvent(
                new ShowToastEvent({
                title: "Please select atleast 1 record to update",
                variant: "error",
                }),
            );
            return;
        }
        this.showEditModal = true;
    }
    hideEditModal(){
        this.showEditModal = false;
    }
    handleSearch(event) {
        const searchKey = event.target.value.toLowerCase();
 
        if (searchKey) {
            this.notes = this.data;
 
            if (this.data) {
                let searchRecords = [];
 
                for (let record of this.data) {
                    let valuesArray = Object.values(record);
 
                    for (let val of valuesArray) {
                        let strVal = String(val);
 
                        if (strVal) {
 
                            if (strVal.toLowerCase().includes(searchKey)) {
                                searchRecords.push(record);
                                break;
                            }
                        }
                    }
                }
 
                this.notes = searchRecords;
            }
        } else {
            this.notes = this.data;
        }
    }
     pageChanged(event){
      //RowNumberOffSet Field which will be used in Data Table to show Index.
      this.rowNumberOffSet = event.detail.rowNumberOffSet;
      //List of Data to be shown in Tabel.
      this.currentPageData= event.detail.currentPageData;
   }
}