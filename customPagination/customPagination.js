//Importing Lightning Element, Track and Api form LWC Module.
import { LightningElement, track, api } from 'lwc';

export default class CustomPagination extends LightningElement {
    
    //Current Page Number.
    @track page = 1;

    //Number of Records to be shown in one page.
    @api perPage;

    //Array of pages.
    @track pages = [];    

    // private variable will be holding list which should be sliced to multiple pages.
    @track pageData;

    //Number of Page to be shown in Pagination Component.
    @api setSize;

    //Getter setter of TableData variable.
    @api
    get tabledata(){
        return this.pageData;
    }
    set tabledata(value) {
        console.log(value);
        this.pages=[];
        this.pageData = value;
        //Number of Pages.
        let numberOfPages = Math.ceil(this.pageData.length / this.perPage);
        //Pushing Pages in Array.
        for (let index = 1; index <= numberOfPages; index++) {
            this.pages.push(index);
        }
        //Set the current Page to 1.
        this.page=1;
        //Call Parent and pass Data to be shown in Table.
        this.callParentAndPassData();
    }
    
    //Setting the color of Page button when page will be rendered.   
    renderedCallback() {
        this.renderButtons();
    }
    
    renderButtons = () => {
        this.template.querySelectorAll('button').forEach((but) => {
            but.style.backgroundColor = this.page === parseInt(but.dataset.id, 10) ? 'dodgerblue' : 'white';
            but.style.color = this.page === parseInt(but.dataset.id, 10) ? 'white' : 'black';
        });
    }
    
    //This function will return List of pages.
    get pagesList() {
        let mid = Math.floor(this.setSize / 2) + 1;
        if (this.page > mid) {
            return this.pages.slice(this.page - mid, this.page + mid - 1);
        }
        return this.pages.slice(0, this.setSize);
    }
    
    //This function will return, if Prev button needs to be visible or not.
    get hasPrev() {
        return this.page > 1;
    }
    
    //This function will return, if next button needs to be visible or not.
    get hasNext() {
        return this.page < this.pages.length
    }
    
    //This function will invoke when User will click Next button.
    onNext = () => {
        //Increasing the Page Number.
        ++this.page;
        //Calling Parent Method to set the list which will be shown to table.
        this.callParentAndPassData();
    }
    
    //This function will invoke when User will click Prev button.
    onPrev = () => {
        //Increasing the Page Number.        
        --this.page;
        //Calling Parent Method to set the list which will be shown to table.
        this.callParentAndPassData();
    }
    
    //This will invoke when User will click Page Number button.
    onPageClick = (e) => {
        //Setting the Page Number which clicked.                
        this.page = parseInt(e.target.dataset.id, 10);
        //Calling Parent Method to set the list which will be shown to table.
        this.callParentAndPassData();
    }
 
    //This function will create a custom event and will send Page data to Parent Component.
    callParentAndPassData(){
        let page = this.page;
        let perpage = this.perPage;
        //Start Index
        let startIndex = (page * perpage) - perpage;
        //End Index
        let endIndex = (page * perpage);
        //Slicing Array from Start Index to End Index.
        let currentPageData=this.pageData.slice(startIndex, endIndex);
        //Row Number Off set will be used to show index in Data Table.
        let rowNumberOffSet= (this.page-1)*this.perPage;
        //Creating a Custom Event and Sending RowNumberOffSet and CurrentPageDate to Parent Component.
        const myEvent = new CustomEvent('change',
                                        {
                                            detail: {
                                                "rowNumberOffSet": rowNumberOffSet,
                                                "currentPageData": currentPageData
                                            }
                                        });
        this.dispatchEvent(myEvent);
    }

}