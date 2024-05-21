var pageUrls = [];

document.addEventListener('DOMContentLoaded', function() {
    var actionButton = document.getElementById('displayTableButton');
    var downloadCsvButton = document.getElementById('downloadCsvButton');

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var currentTab = tabs[0];
        var statusElement = document.getElementById('status');
        var totalElement = document.getElementById('total');
        var baseUrl = currentTab.url;

        if (baseUrl.includes('https://app.apollo.io/')) {
            statusElement.textContent = "You found a list!";
            statusElement.style.fontSize = "20px";
            actionButton.disabled = false;
            actionButton.classList.add("activeButton");
            actionButton.style.backgroundColor = "#007BFF";
            actionButton.style.color = "white";
            actionButton.style.cursor = "pointer";
            actionButton.addEventListener('mouseenter', function() {
                this.style.backgroundColor = "#0056b3";
            });
            actionButton.addEventListener('mouseleave', function() {
                this.style.backgroundColor = "#007BFF";
            });

            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: function() {
                    // Find the span element by its class name
                    function findTotalInSpanWithSpace() {
                        // Initialize totalNumber to 0 by default
                        let totalText = 0;
                        
                        // Get all <span> elements in the document
                        const spanElements = document.querySelectorAll('span');
                        
                        // Iterate through each <span> to find the matching text
                        for (let i = 0; i < spanElements.length; i++) {
                            const textContent = spanElements[i].textContent.trim();
                            // Adjusted regex to ensure there's a space after 'of'
                            const match = textContent.match(/of\s([\d,]+)/);
                            
                            // If a match is found, extract the number, remove commas, and convert to an integer
                            if (match && match[1]) {
                                totalText = parseInt(match[1].replace(/,/g, ''), 10);
                                break; // Stop searching once a match is found
                            }
                        }
                        
                        return totalText;
                    }
                    
                    const totalText = findTotalInSpanWithSpace();
                    console.log(totalText); // This will display the number found after "of ", e.g., 1026

                    return totalText;
                },
            }, function(results) {
                if (chrome.runtime.lastError) {
                    totalElement.textContent = `Error: ${chrome.runtime.lastError.message}`;
                } else {
                    const total = results[0].result;
                    let pages = Math.ceil(total / 25);
                    pages = pages > 100 ? 100 : pages;
                    let totalText = `<b>${total}</b> total contacts found`;
                    let pagesText = ` on <b>${pages}</b> pages.`;
                    
                    totalElement.innerHTML = totalText + pagesText;
                    totalElement.style.fontSize = "20px";

                    // Generate page URLs and store them in the array
                    for (let i = 1; i <= pages; i++) {
                        baseUrl = baseUrl.replace(/&page=\d+/, '');
                        const pageUrl = `${baseUrl}&page=${i}`;
                        pageUrls.push(pageUrl);
                    }
                }
            });
        } else {
            statusElement.textContent = "Please go to an Apollo.io List URL";
            statusElement.style.fontSize = "20px";
            actionButton.disabled = true;
            actionButton.classList.remove("activeButton");
            actionButton.style.backgroundColor = "grey";
            actionButton.style.color = "white";
            actionButton.style.cursor = "not-allowed";
        }
    });

    downloadCsvButton.addEventListener('click', function() {
        downloadTableAsCsv();
    });
});

var allTableData = [];

document.getElementById('displayTableButton').addEventListener('click', function() {
    // Clear the data
    allTableData = [];
    document.getElementById('tableContainer').innerHTML = '';

    // Then fetch all tables
    getAllTables();
});

function getAllTables() {
    const pageLinks = pageUrls;
    const timeBetweenPages = document.getElementById('timeBetweenPages').value * 1000;
    pageLinks.forEach((pageLink, index) => {
        setTimeout(() => {
            chrome.tabs.update({url: pageLink}, function(tab) {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (info.status === 'complete' && tabId === tab.id) {
                        chrome.tabs.onUpdated.removeListener(listener);
                        chrome.scripting.executeScript({
                            target: {tabId: tab.id},
                            function: findAndSendTableData,
                        }, function(results) {
                            if (chrome.runtime.lastError) {
                                console.error(`Error: ${chrome.runtime.lastError.message}`);
                            } else {
                                allTableData.push(results[0].result);
                                if (index === pageLinks.length - 1) {
                                    document.getElementById('tableContainer').innerHTML = allTableData.join('');
                                }
                            }
                        });
                    }
                });
            });
        }, index * timeBetweenPages); // Wait 5 seconds between each page to avoid overloading the server
    });
}

function findAndSendTableData() {
    const table = document.querySelector('table');
    if (!table) {
        chrome.runtime.sendMessage({error: "No table found on the page."});
        return '';
    }

    const clonedTable = table.cloneNode(true);
    const elementsToRemove = clonedTable.querySelectorAll('svg, img, button, input[type="checkbox"]');
    elementsToRemove.forEach(el => el.parentNode.removeChild(el));

    // Regular expression to match phone numbers
    const phoneRegex = /\+\d{11}/g;
    const cells = clonedTable.querySelectorAll('td');
    cells.forEach(cell => {
        let text = cell.textContent;
        const matches = text.match(phoneRegex);
        if (matches) {
            matches.forEach(match => {
                // Format the phone number
                const formatted = match.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
                text = text.replace(match, formatted);
            });
        }

        text = text.replace(/[^a-zA-Z0-9\s,.@-]/g, '').replace(/Â/g, '');
        cell.textContent = text;
    });

    // Assume getField1Data and getField2Data are functions or logic that return the data for the new fields in each row
    function getCompanyLink(rowIndex) {
        table_row = table.querySelectorAll('tr')[rowIndex];
        links = table_row.querySelectorAll('a');

        const companyLink = Array.from(links).filter(link => !link.href.includes('linkedin.com') && !link.href.includes('contacts') && !link.href.includes('facebook.com') && !link.href.includes('twitter.com') && !link.href.includes('accounts'));

        if (companyLink.length > 0) {
            console.log('Links without "linkedin" and "contacts":', companyLink);
        //   withoutcomma = companyLink.replace(/,/g, '');
            return companyLink;
        } else {
            console.log('All links contain either "linkedin" or "contacts".');
            return '';
        }
    }

    function getLinkedInLink(rowIndex) {
        table_row = table.querySelectorAll('tr')[rowIndex];
        links = table_row.querySelectorAll('a');
        const linkedInLink = Array.from(links).find(link => link.href.includes('linkedin.com/company/'));

        if (linkedInLink) {
            console.log('LinkedIn Company Link:', linkedInLink.href);
            return linkedInLink.href;
        } else {
            console.log('No LinkedIn Company link found.');
            return '';
        }
    }

    // Add new columns to each row (including the header if present)
    const rows = clonedTable.querySelectorAll('tr');
    rows.forEach(row => {
        const newCell1 = row.insertCell(); // Append new cell to the end of the row
        const newField1Content = row.rowIndex === 0 ? 'Company Website' : getCompanyLink(row.rowIndex);
        newCell1.textContent = newField1Content;

        const newCell2 = row.insertCell(); // Append another new cell for the second column
        const newField2Content = row.rowIndex === 0 ? 'Company LinkedIn' : getLinkedInLink(row.rowIndex);
        newCell2.textContent = newField2Content;
    });
    
    return clonedTable.outerHTML;
}

function downloadTableAsCsv() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) {
        console.error("No table container found on the page to download.");
        return;
    }
    
    let csvContent = "\uFEFF";
    let headerProcessed = false;

    const rows = tableContainer.querySelectorAll("table tr");
    let nameIndex = -1;
    let quickActionsIndex = -1;
    let companyWebsiteKeep = -1; // Add this line to store the index of the column to keep
    let companyLinkedInKeep = -1; // Add this line to store the index of the column to keep

    for (const row of rows) {
        let rowData = [];
        const cells = row.querySelectorAll("th, td");
        for (let i = 0; i < cells.length; i++) {
            if (row === rows[0]) {
                if (!headerProcessed) {
                    if (cells[i].innerText === "Name") {
                        nameIndex = i;
                    } else if (cells[i].innerText === "Quick Actions") {
                        quickActionsIndex = i;
                        continue;
                    } else if (cells[i].innerText === "Company Website") { // Replace with the header text of the column you want to keep
                        companyWebsiteKeep = i; // Store the index of the column to keep
                    } else if (cells[i].innerText === "Company LinkedIn") { // Replace with the header text of the column you want to keep
                        companyLinkedInKeep = i; // Store the index of the column to keep
                    }
                } else {
                    continue;
                }
            }

            if (i === quickActionsIndex) continue;
            let cellText = cells[i].innerText;
            if (i === nameIndex) {
                if (row === rows[0] && !headerProcessed) {
                    rowData.push(`"First Name"`, `"Last Name"`, `"Full Name"`);
                } else {
                    const names = cellText.split(' ');
                    const firstName = names[0] || '';
                    const lastName = names.slice(1).join(' ') || '';
                    const fullName = cellText;
                    rowData.push(`"${firstName}"`, `"${lastName}"`, `"${fullName}"`);
                } 
                continue;
            }

            if (i === companyWebsiteKeep) {
                // Keep the original cell text without any replacement or cleaning
                cellText = cellText.replace(/,/g, '')
                rowData.push(`"${cellText}"`);
            } else if (i === companyLinkedInKeep) {
                // Keep the original cell text without any replacement or cleaning
                cellText = cellText.replace(/,/g, '')
                rowData.push(`"${cellText}"`);
            } else {
                if (cellText === "No email" || cellText === "Request Mobile Number" || cellText === "NA") {
                    cellText = " ";
                }

                cellText = cellText.replace(/[^a-zA-Z0-9\s,.@-]/g, '').replace(/Â/g, '');
                cellText = cellText.replace(/"/g, '""').replace(/#/g, ''); 
                cellText = cellText.trim();
                rowData.push(`"${cellText}"`);
            }
        }

        // Skip the row if it contains the word "Name" in a single cell after the first row
        if (row !== rows[0] && rowData.some(cell => cell.includes("Name"))) {
            continue;
        }

        csvContent += rowData.join(",") + "\r\n";
        if (row === rows[0]) {
            headerProcessed = true;
        }
    }

    const fileNameInput = document.getElementById('fileName');
    const fileName = fileNameInput.value || 'tableData'; 
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName + ".csv");
    document.body.appendChild(link);
    
    link.click(); 
    document.body.removeChild(link); 
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.tableData) {
        allTableData.push(message.tableData);
        document.getElementById('tableContainer').innerHTML = allTableData.join('');
    } else if (message.error) {
        document.getElementById('tableContainer').textContent = message.error;
    }
});