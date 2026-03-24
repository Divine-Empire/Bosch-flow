"use client"

import { useState, useEffect } from "react"
import QuotationDetails from "./quotation-details"
import ConsignorDetails from "./consignor-details"
import ConsigneeDetails from "./consignee-details"
import ItemsTable from "./items-table"
import TermsAndConditions from "./terms and conditions"
import BankDetails from "./bank-details"
import NotesSection from "./notes-section"
import SpecialOfferSection from "./special-offer-section"
import { getCompanyPrefix, getNextQuotationNumber } from "./quotation-service"

const QuotationForm = ({
  quotationData,
  handleInputChange,
  handleItemChange,
  handleFlatDiscountChange,
  handleAddItem,
  handleNoteChange,
  addNote,
  removeNote,
  hiddenFields,
  toggleFieldVisibility,
  isRevising,
  existingQuotations,
  selectedQuotation,
  handleSpecialDiscountChange,
  handleQuotationSelect,
  isLoadingQuotation,
  specialDiscount,
  setSpecialDiscount,
  selectedReferences,
  setSelectedReferences,
  imageform,
  addSpecialOffer,
  removeSpecialOffer,
  handleSpecialOfferChange,
  setQuotationData, // ADD THIS LINE
  hiddenColumns,    // ADD THIS LINE
  setHiddenColumns, // ADD THIS LINE
}) => {
  const [dropdownData, setDropdownData] = useState({})
  const [stateOptions, setStateOptions] = useState(["Select State"])
  const [dropdownCompanyOptions, setDropdownCompanyOptions] = useState(["Select Company"])
  const [indentCompanyOptions, setIndentCompanyOptions] = useState(["Select Company"])
  const [referenceOptions, setReferenceOptions] = useState(["Select Reference"])
  const [preparedByOptions, setPreparedByOptions] = useState([""])
  const [productCodes, setProductCodes] = useState([])
  const [productNames, setProductNames] = useState([])
  const [productData, setProductData] = useState({})
  const [isItemsLoading, setIsItemsLoading] = useState(false);

  // NEW: Lead number states
  const [showLeadNoDropdown, setShowLeadNoDropdown] = useState(false)
  const [leadNoOptions, setLeadNoOptions] = useState(["Select Lead No."])
  const [leadNoData, setLeadNoData] = useState({})

  // Fetch dropdown data for states and corresponding details
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const scriptUrl = "https://script.google.com/macros/s/AKfycbwkvholGxpU6WFQt3i9pzctKXkBHsY-qkeJd8DenMCMANbKHq5rp3ULEV67uGrWhTDoag/exec"
        console.log("Fetching general dropdown data from:", `${scriptUrl}?sheet=DROPDOWN`)
        const dropdownResponse = await fetch(`${scriptUrl}?sheet=DROPDOWN`)
        const result = await dropdownResponse.json()

        if (result.success && result.data) {
          console.log("General dropdown data (DROPDOWN) received:", result.data.length, "rows")
          const stateOptionsData = ["Select State"]
          const stateDetailsMap = {}
          const preparedByOptionsData = [""]
          const companyOptionsData = ["Select Company"]
          const companyDetailsMap = {}
          const referenceOptionsData = ["Select Reference"]
          const referenceDetailsMap = {}

          // result.data is a 2D array [row][col]
          // Skip header row (index 0)
          result.data.slice(1).forEach((row) => {
            if (row) {
              const preparedByName = row[9] ? String(row[9]).trim() : ""
              if (preparedByName && preparedByName !== "PREPARED BY" && !preparedByOptionsData.includes(preparedByName)) {
                preparedByOptionsData.push(preparedByName)
              }

              const stateName = row[4] ? String(row[4]).trim() : ""
              if (stateName && stateName !== "STATE" && !stateOptionsData.includes(stateName)) {
                stateOptionsData.push(stateName)

                let bankDetails = row[10] || ""

                const pan = row[11] || ""
                const msmeNumber = row[12] || ""

                stateDetailsMap[stateName] = {
                  bankDetails: bankDetails,
                  consignerAddress: row[28] || "",
                  stateCode: row[18] || "",
                  gstin: row[17] || "",
                  pan: pan,
                  msmeNumber: msmeNumber,
                }
              }

              // Column A is index 0 (for Company Name)
              const companyName = row[0] ? String(row[0]).trim() : ""
              if (companyName && companyName !== "Company Name" && !companyOptionsData.includes(companyName)) {
                companyOptionsData.push(companyName)

                companyDetailsMap[companyName] = {
                  contactName: row[13] ? String(row[13]).trim() : "", // Column N (index 13)
                  contactNo: row[14] ? String(row[14]).trim() : "",   // Column O (index 14)
                  address: row[15] ? String(row[15]).trim() : "",     // Column P (index 15)
                  state: row[16] ? String(row[16]).trim() : "",       // Column Q (index 16)
                  gstin: row[17] ? String(row[17]).trim() : "",       // Column R (index 17)
                  stateCode: row[18] ? String(row[18]).trim() : "",   // Column S (index 18)
                  msmeNumber: row[12] ? String(row[12]).trim() : "",  // Column M (index 12)
                }
              }

              const referenceName = row[1] ? String(row[1]).trim() : ""
              if (referenceName && referenceName !== "REFERENCE" && !referenceOptionsData.includes(referenceName)) {
                referenceOptionsData.push(referenceName)

                referenceDetailsMap[referenceName] = {
                  mobile: row[2] || "",
                  phone: row[3] || "",
                  gstin: row[17] || "",     // Column R (index 17)
                  stateCode: row[18] || "", // Column S (index 18)
                  msmeNumber: row[12] || "", // Column M (index 12)
                }
              }
            }
          })

          setStateOptions(stateOptionsData)
          setPreparedByOptions(preparedByOptionsData)
          setReferenceOptions(referenceOptionsData)
          setDropdownCompanyOptions(companyOptionsData) // Store DROPDOWN company options separately
          setDropdownData((prev) => ({
            ...prev,
            states: stateDetailsMap,
            references: referenceDetailsMap,
            companies: companyDetailsMap, // Add this to enable autofill
          }))

          // NEW: Fetch company names from Indent sheet Column E (index 4)
          console.log("Fetching company names from Indent sheet...")
          const indentCompanyResponse = await fetch(`${scriptUrl}?sheet=Indent`)
          const indentCompanyResult = await indentCompanyResponse.json()

          if (indentCompanyResult.success && indentCompanyResult.data) {
            const indentCompanyOptions = ["Select Company"]
            indentCompanyResult.data.slice(1).forEach((row) => {
              if (row && row[4]) {
                const companyName = String(row[4]).trim()
                if (companyName && companyName !== "Company Name" && companyName !== "Customer Name" && !indentCompanyOptions.includes(companyName)) {
                  indentCompanyOptions.push(companyName)
                }
              }
            })
            setIndentCompanyOptions(indentCompanyOptions) // Store Indent company options separately
            console.log("Company options updated from Indent sheet. Count:", indentCompanyOptions.length)
          }

          console.log("General dropdown states updated.")
        }
      } catch (error) {
        console.error("Error fetching dropdown data:", error)

        setStateOptions(["Select State", "Chhattisgarh", "Maharashtra", "Delhi"])
        setCompanyOptions(["Select Company", "ABC Corp", "XYZ Industries", "PQR Ltd"])
        setReferenceOptions(["Select Reference", "John Doe", "Jane Smith", "Mike Johnson"])

        setDropdownData({
          states: {
            Chhattisgarh: {
              bankDetails:
                "Account No.: 438605000447\nBank Name: ICICI BANK\nBank Address: FAFADIH, RAIPUR\nIFSC CODE: ICIC0004386\nEmail: Support@thedivineempire.com\nWebsite: www.thedivineempire.com",
              consignerAddress: "Divine Empire Private Limited, Raipur, Chhattisgarh",
              stateCode: "22",
              gstin: "22AAKCD1234M1Z5",
            },
          },
          companies: {
            "ABC Corp": {
              address: "123 Main Street, Mumbai, Maharashtra",
              state: "Maharashtra",
              contactName: "Rajesh Kumar",
              contactNo: "9876543210",
              gstin: "27ABCDE1234F1Z5",
              stateCode: "27",
            },
          },
          references: {
            "John Doe": {
              mobile: "9898989898",
            },
          },
        })
      }
    }

    fetchDropdownData()
  }, [])

  // NEW: Fetch lead numbers from three sheets with filtering conditions
  useEffect(() => {
    const fetchLeadNumbers = async () => {
      try {
        const leadNoOptionsData = ["Select Lead No."]
        const leadNoDataMap = {}

        const scriptUrl = "https://script.google.com/macros/s/AKfycbwkvholGxpU6WFQt3i9pzctKXkBHsY-qkeJd8DenMCMANbKHq5rp3ULEV67uGrWhTDoag/exec"

        // NEW: Fetch from Indent sheet
        const indentResponse = await fetch(`${scriptUrl}?sheet=Indent`)
        const indentResult = await indentResponse.json()

        if (indentResult.success && indentResult.data) {
          // Skip header row
          indentResult.data.slice(1).forEach((row) => {
            if (row && row[1]) {
              // Column B (index 1)
              const leadNo = String(row[1]).trim()

              if (leadNo && leadNo !== "null" && leadNo !== "undefined" && leadNo !== "Indent No" && !leadNoOptionsData.includes(leadNo)) {
                leadNoOptionsData.push(leadNo)

                // For Indent sheet, we might not have all the mapping yet, but we store what's possible
                leadNoDataMap[leadNo] = {
                  sheet: "Indent",
                  companyName: row[4] ? String(row[4]).trim() : "", // Column E
                  address: row[7] ? String(row[7]).trim() : "", // Column H
                  state: row[8] ? String(row[8]).trim() : "", // Column I
                  contactName: row[5] ? String(row[5]).trim() : "", // Column F
                  contactNo: row[6] ? String(row[6]).trim() : "", // Column G
                  gstin: row[9] ? String(row[9]).trim() : "", // Column J
                  stateCode: row[82] ? String(row[82]).trim() : "", // Column CE
                  shipTo: "",
                  rowData: row,
                }
              }
            }
          })
        }

        setLeadNoOptions(leadNoOptionsData)
        setLeadNoData(leadNoDataMap)
      } catch (error) {
        console.error("Error fetching lead numbers:", error)
      }
    }

    fetchLeadNumbers()
  }, [])

  const handleSpecialDiscountChangeWrapper = (value) => {
    const discount = Number(value) || 0
    setSpecialDiscount(discount)
    handleSpecialDiscountChange(discount)
  }

  useEffect(() => {
    const fetchProductData = async () => {
      try {
        const scriptUrl = "https://script.google.com/macros/s/AKfycbwkvholGxpU6WFQt3i9pzctKXkBHsY-qkeJd8DenMCMANbKHq5rp3ULEV67uGrWhTDoag/exec"
        console.log("Fetching product data (DROPDOWN) from Apps Script...")
        const response = await fetch(`${scriptUrl}?sheet=DROPDOWN`)
        const result = await response.json()

        if (result.success && result.data) {
          console.log("Product data (DROPDOWN) received:", result.data.length, "rows")
          const codes = ["Select Code"]
          const names = ["Select Product"]
          const productDataMap = {}

          // result.data is a 2D array
          result.data.slice(1).forEach((row) => {
            if (row) {
              // F is index 5 (Code)
              // G is index 6 (Product Name)
              // H is index 7 (Rate)
              // I is index 8 (Description)
              const code = row[5] ? String(row[5]).trim() : ""
              const name = row[6] ? String(row[6]).trim() : ""
              const description = row[8] ? String(row[8]).trim() : ""
              const rate = row[7] ? Number.parseFloat(String(row[7]).replace(/[^0-9.]/g, "")) || 0 : 0

              if (code && code !== "ITEM CODE" && code !== "Code" && !codes.includes(code)) {
                codes.push(code)
                productDataMap[code] = {
                  code: code,
                  name: name,
                  description: description,
                  rate: rate,
                }
              }

              if (name && name !== "ITEM NAME" && name !== "Product Name" && !names.includes(name)) {
                names.push(name)
                // Also map by name for full product info retrieval
                if (!productDataMap[name]) {
                  productDataMap[name] = {
                    code: code,
                    name: name,
                    description: description,
                    rate: rate,
                  }
                }
              }
            }
          })

          setProductCodes(codes)
          setProductNames(names)
          setProductData(productDataMap)
          console.log("Product states updated. Codes count:", codes.length)
        }
      } catch (error) {
        console.error("Error fetching product data:", error)
      }
    }

    fetchProductData()
  }, [])

  // Function to handle quotation number updates
  const handleQuotationNumberUpdate = (newQuotationNumber) => {
    handleInputChange("quotationNo", newQuotationNumber)
  }

  // Helper function to safely convert value to string
  const safeToString = (value) => {
    if (value === null || value === undefined) return ""
    return String(value)
  }

  // NEW: Handle lead number selection and autofill
  const handleLeadNoSelect = async (selectedLeadNo) => {
    if (!selectedLeadNo || selectedLeadNo === "Select Lead No." || !leadNoData[selectedLeadNo]) {
      return;
    }

    setIsItemsLoading(true); // Start loading

    const leadData = leadNoData[selectedLeadNo]

    // Fill consignee details
    const companyName = leadData.companyName
    handleInputChange("consigneeName", companyName)
    handleInputChange("consigneeAddress", leadData.address)
    handleInputChange("consigneeState", leadData.state)
    handleInputChange("consigneeContactName", leadData.contactName)
    handleInputChange("consigneeContactNo", leadData.contactNo)
    handleInputChange("consigneeGSTIN", leadData.gstin)
    handleInputChange("consigneeStateCode", leadData.stateCode)

    if (leadData.shipTo) {
      handleInputChange("shipTo", leadData.shipTo)
    }

    // IMPORTANT: Fill additional company details from dropdown data if available
    if (companyName && dropdownData.companies && dropdownData.companies[companyName]) {
      const companyDetails = dropdownData.companies[companyName]

      // Fill additional company details if not already filled from lead data
      if (!leadData.address && companyDetails.address) {
        handleInputChange("consigneeAddress", companyDetails.address)
      }
      if (!leadData.state && companyDetails.state) {
        handleInputChange("consigneeState", companyDetails.state)
      }
      if (!leadData.contactName && companyDetails.contactName) {
        handleInputChange("consigneeContactName", companyDetails.contactName)
      }
      if (!leadData.contactNo && companyDetails.contactNo) {
        handleInputChange("consigneeContactNo", companyDetails.contactNo)
      }
      if (!leadData.gstin && companyDetails.gstin) {
        handleInputChange("consigneeGSTIN", companyDetails.gstin)
      }
      if (companyDetails.stateCode) {
        handleInputChange("consigneeStateCode", companyDetails.stateCode)
      }
    }

    // CRITICAL: Get company prefix and update quotation number based on company name
    try {
      const companyPrefix = await getCompanyPrefix(companyName)
      const newQuotationNumber = await getNextQuotationNumber(companyPrefix)
      handleInputChange("quotationNo", newQuotationNumber)
    } catch (error) {
      console.error("Error updating quotation number from lead selection:", error)
    }

    // Auto-fill items using the local handleAutoFillItems function
    try {
      await handleAutoFillItems(companyName)
    } catch (error) {
      console.error("Error auto-filling items:", error)
    }

    // Wait a bit to ensure productData is available
    await new Promise(resolve => setTimeout(resolve, 100))

    // Auto-fill items based on sheet data
    const autoItems = []

    if (leadData.sheet === "FMS") {
      const row = leadData.rowData
      const baValue = row[52] ? safeToString(row[52].v) : ""
      const bbValue = row[53] ? safeToString(row[53].v) : ""
      const biValue = row[60] ? safeToString(row[60].v) : ""


      if (baValue !== "" && biValue === "") {

        // Regular columns AN-AW (indices 39-48)
        const itemColumns = [
          { nameCol: 39, qtyCol: 40 }, // AN, AO
          { nameCol: 41, qtyCol: 42 }, // AP, AQ
          { nameCol: 43, qtyCol: 44 }, // AR, AS
          { nameCol: 45, qtyCol: 46 }, // AT, AU
          { nameCol: 47, qtyCol: 48 }, // AV, AW
        ]

        for (const { nameCol, qtyCol } of itemColumns) {
          const itemName = row[nameCol] ? safeToString(row[nameCol].v).trim() : ""
          const itemQty = row[qtyCol] ? safeToString(row[qtyCol].v) : ""


          if (itemName !== "" && itemQty !== "") {
            const qty = isNaN(Number(itemQty)) ? 1 : Number(itemQty)
            autoItems.push({
              name: itemName,
              qty: qty,
            })
          }
        }

        // JSON data from CS column (index 96)
        const csValue = row[96] ? safeToString(row[96].v) : ""

        if (csValue !== "" && csValue !== "null" && csValue !== "undefined") {
          try {
            const jsonData = JSON.parse(csValue)
            if (Array.isArray(jsonData)) {
              jsonData.forEach((item) => {
                if (item.name && item.quantity !== undefined && item.quantity !== null) {
                  const qty = isNaN(Number(item.quantity)) ? 1 : Number(item.quantity)
                  autoItems.push({
                    name: item.name,
                    qty: qty,
                  })
                }
              })
            }
          } catch (error) {
            console.error("Error parsing JSON data from FMS:", error)
          }
        }
      } else {
        console.log("FMS lead conditions not met - BA:", baValue, "BI:", biValue)
      }
    }

    // Update items if found from lead data
    if (autoItems.length > 0) {

      const newItems = autoItems.map((item, index) => {
        // Auto-fill product code from productData with better matching
        let productInfo = null
        let productCode = ""
        let productDescription = ""
        let productRate = 0

        // Try exact match first
        if (productData[item.name]) {
          productInfo = productData[item.name]
        } else {
          // Try case-insensitive match
          const matchingKey = Object.keys(productData).find(key =>
            key.toLowerCase().trim() === item.name.toLowerCase().trim()
          )
          if (matchingKey) {
            productInfo = productData[matchingKey]
          }
        }

        if (productInfo) {
          productCode = productInfo.code || ""
          productDescription = productInfo.description || ""
          productRate = productInfo.rate || 0
        }


        // If no code found, try a partial match
        if (!productCode) {
          const partialMatch = Object.keys(productData).find(key =>
            key.toLowerCase().includes(item.name.toLowerCase().substring(0, 10)) ||
            item.name.toLowerCase().includes(key.toLowerCase().substring(0, 10))
          )
          if (partialMatch && productData[partialMatch]) {
            productCode = productData[partialMatch].code || ""
            productDescription = productData[partialMatch].description || ""
            productRate = productData[partialMatch].rate || 0
          }
        }

        return {
          id: index + 1,
          code: productCode, // Auto-filled from productData
          name: item.name,
          description: productDescription, // Auto-filled from productData
          gst: 18,
          qty: item.qty,
          units: "Nos",
          rate: productRate, // Auto-filled from productData
          discount: 0,
          flatDiscount: 0,
          amount: item.qty * productRate, // Calculate initial amount
        }
      })

      handleInputChange("items", newItems)
    }

    setIsItemsLoading(false); // Stop loading
  }

  // Function to auto-fill items based on company selection
  const handleAutoFillItems = async (companyName) => {
    if (!companyName || companyName === "Select Company") return

    try {
      setIsItemsLoading(true)

      // First try FMS sheet
      const fmsUrl =
        "https://docs.google.com/spreadsheets/d/1rU3-YbHmR7lmx5F1_VCtrQm1EL_i27jwF3ychvzSpj4/gviz/tq?tqx=out:json&sheet=FMS"
      const fmsResponse = await fetch(fmsUrl)
      const fmsText = await fmsResponse.text()

      const fmsJsonStart = fmsText.indexOf("{")
      const fmsJsonEnd = fmsText.lastIndexOf("}") + 1
      const fmsJsonData = fmsText.substring(fmsJsonStart, fmsJsonEnd)
      const fmsData = JSON.parse(fmsJsonData)

      let itemsFound = false
      const autoItems = []

      // Check FMS sheet first
      if (fmsData && fmsData.table && fmsData.table.rows) {
        for (const row of fmsData.table.rows) {
          if (row.c && row.c[4]) {
            // Column E (index 4) - Project Name
            const rowCompanyName = safeToString(row.c[4].v)

            if (rowCompanyName && rowCompanyName.toLowerCase().trim() === companyName.toLowerCase().trim()) {
              // Check if BA (index 52) is not null and BI (index 60) is null
              const baValue = row.c[52] ? safeToString(row.c[52].v) : ""
              const biValue = row.c[60] ? safeToString(row.c[60].v) : ""

              if (baValue !== "" && biValue === "") {
                // FIRST: Extract items from regular columns (AN to AW)
                const itemColumns = [
                  { nameCol: 39, qtyCol: 40 }, // AN (Item Name1), AO (Quantity1)
                  { nameCol: 41, qtyCol: 42 }, // AP (Item Name2), AQ (Quantity2)
                  { nameCol: 43, qtyCol: 44 }, // AR (Item Name3), AS (Quantity3)
                  { nameCol: 45, qtyCol: 46 }, // AT (Item Name4), AU (Quantity4)
                  { nameCol: 47, qtyCol: 48 }, // AV (Item Name5), AW (Quantity5)
                ]

                for (const { nameCol, qtyCol } of itemColumns) {
                  const itemName = row.c[nameCol] ? safeToString(row.c[nameCol].v).trim() : ""
                  const itemQty = row.c[qtyCol] ? safeToString(row.c[qtyCol].v) : ""

                  if (itemName !== "" && itemQty !== "") {
                    // Fix: Preserve 0 quantities, only use fallback for invalid numbers
                    const qty = isNaN(Number(itemQty)) ? 1 : Number(itemQty)
                    autoItems.push({
                      name: itemName,
                      qty: qty,
                    })
                  }
                }

                const csValue = row.c[96] ? safeToString(row.c[96].v) : ""

                if (csValue !== "") {
                  try {
                    // Parse JSON data from CS column
                    const jsonData = JSON.parse(csValue) // Corrected from cbValue

                    if (Array.isArray(jsonData)) {
                      jsonData.forEach((item) => {
                        if (item.name && item.quantity !== undefined && item.quantity !== null) {
                          // Fix: Preserve 0 quantities, only use fallback for invalid numbers
                          const qty = isNaN(Number(item.quantity)) ? 1 : Number(item.quantity)
                          autoItems.push({
                            name: item.name,
                            qty: qty,
                          })
                        }
                      })
                    }
                  } catch (jsonError) {
                    console.error("Error parsing JSON from CS column:", jsonError)
                  }
                }

                itemsFound = true
                break
              }
            }
          }
        }
      }

      // If items found, auto-fill the quotation table
      if (itemsFound && autoItems.length > 0) {
        // Clear existing items and add new ones
        const newItems = autoItems.map((item, index) => {
          // Look up the product code from productData
          const productInfo = productData[item.name]
          const productCode = productInfo ? productInfo.code : ""

          return {
            id: index + 1,
            code: productCode, // Auto-fill the code from productData
            name: item.name,
            description: "",
            gst: 18,
            qty: item.qty,
            units: "Nos",
            rate: 0,
            discount: 0,
            flatDiscount: 0,
            amount: 0,
          }
        })

        // Update quotation data with new items
        handleInputChange("items", newItems)
      }
    } catch (error) {
      console.error("Error auto-filling items:", error)
    } finally {
      setIsItemsLoading(false) // Stop loading regardless of success/failure
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <QuotationDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            isRevising={isRevising}
            existingQuotations={existingQuotations}
            selectedQuotation={selectedQuotation}
            handleQuotationSelect={handleQuotationSelect}
            isLoadingQuotation={isLoadingQuotation}
            preparedByOptions={preparedByOptions}
            stateOptions={stateOptions}
            dropdownData={dropdownData}
          />

          <ConsignorDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            referenceOptions={referenceOptions}
            selectedReferences={selectedReferences}
            setSelectedReferences={setSelectedReferences}
            dropdownData={dropdownData}
          />
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <ConsigneeDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            companyOptions={showLeadNoDropdown ? indentCompanyOptions : dropdownCompanyOptions}
            dropdownData={dropdownData}
            onQuotationNumberUpdate={handleQuotationNumberUpdate}
            onAutoFillItems={handleAutoFillItems}
            showLeadNoDropdown={showLeadNoDropdown}
            setShowLeadNoDropdown={setShowLeadNoDropdown}
            leadNoOptions={leadNoOptions}
            handleLeadNoSelect={handleLeadNoSelect}
          />
        </div>
      </div>

      <ItemsTable
        quotationData={quotationData}
        handleItemChange={handleItemChange}
        handleAddItem={handleAddItem}
        handleSpecialDiscountChange={handleSpecialDiscountChangeWrapper}
        specialDiscount={specialDiscount}
        setSpecialDiscount={setSpecialDiscount}
        productCodes={productCodes}
        productNames={productNames}
        productData={productData}
        setQuotationData={setQuotationData}
        isLoading={isItemsLoading}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
      />

      <TermsAndConditions
        quotationData={quotationData}
        handleInputChange={handleInputChange}
        hiddenFields={hiddenFields}
        toggleFieldVisibility={toggleFieldVisibility}
      />

      <SpecialOfferSection
        quotationData={quotationData}
        handleInputChange={handleInputChange}
        addSpecialOffer={addSpecialOffer}
        removeSpecialOffer={removeSpecialOffer}
        handleSpecialOfferChange={handleSpecialOfferChange}
      />

      <NotesSection
        quotationData={quotationData}
        handleNoteChange={handleNoteChange}
        addNote={addNote}
        removeNote={removeNote}
      />

      <BankDetails quotationData={quotationData} handleInputChange={handleInputChange} imageform={imageform} />
    </div>
  )
}

export default QuotationForm