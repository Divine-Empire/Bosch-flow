"use client"

import { useState, useEffect } from "react"
import { DownloadIcon, SaveIcon, ShareIcon } from "../../components/Icons"
import image1 from "../../assests/WhatsApp Image 2025-05-14 at 4.11.43 PM.jpeg"
import imageform from "../../assests/WhatsApp Image 2025-05-14 at 4.11.54 PM.jpeg"
import QuotationHeader from "./quotation-header"
import QuotationForm from "./quotation-form"
import QuotationPreview from "./quotation-preview"
import { generatePDFFromData } from "./pdf-generator"
import { useQuotationData } from "./use-quotation-data"



// NEW: Function to get company prefix from FMS sheet
// NEW: Enhanced function to get company prefix from both FMS and ENQUIRY TO ORDER sheets



export const getNextQuotationNumber = async (companyPrefix = "OT") => {
  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbwkvholGxpU6WFQt3i9pzctKXkBHsY-qkeJd8DenMCMANbKHq5rp3ULEV67uGrWhTDoag/exec"

  try {
    const params = {
      sheetName: "Make Quotation",
      action: "getNextQuotationNumber",
      companyPrefix: companyPrefix, // Pass the dynamic prefix
    }

    const urlParams = new URLSearchParams()
    for (const key in params) {
      urlParams.append(key, params[key])
    }

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: urlParams,
    })

    const result = await response.json()

    if (result.success) {
      return result.nextQuotationNumber
    } else {
      // Get current financial year
      const now = new Date()
      const currentYear = now.getFullYear()
      const financialYearStart = now.getMonth() >= 3 ? currentYear : currentYear - 1
      const financialYearEnd = financialYearStart + 1
      const startShort = String(financialYearStart).slice(-2)
      const endShort = String(financialYearEnd).slice(-2)
      const currentFY = startShort + "-" + endShort

      return `${companyPrefix}-${currentFY}-0001`
    }
  } catch (error) {
    console.error("Error getting next quotation number:", error)

    // Get current financial year
    const now = new Date()
    const currentYear = now.getFullYear()
    const financialYearStart = now.getMonth() >= 3 ? currentYear : currentYear - 1
    const financialYearEnd = financialYearStart + 1
    const startShort = String(financialYearStart).slice(-2)
    const endShort = String(financialYearEnd).slice(-2)
    const currentFY = startShort + "-" + endShort

    return `${companyPrefix}-${currentFY}-0001`
  }
}


export const getCompanyPrefix = async (companyName) => {
  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbwkvholGxpU6WFQt3i9pzctKXkBHsY-qkeJd8DenMCMANbKHq5rp3ULEV67uGrWhTDoag/exec"

  try {
    const params = {
      sheetName: "FMS", // This parameter is still needed but the script will check both sheets
      action: "getCompanyPrefix",
      companyName: companyName,
    }

    const urlParams = new URLSearchParams()
    for (const key in params) {
      urlParams.append(key, params[key])
    }

    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: urlParams,
    })

    const result = await response.json()

    if (result.success && result.prefix) {
      console.log("Retrieved company prefix:", result.prefix, "for company:", companyName)
      return result.prefix
    } else {
      console.log("No prefix found, using default OT")
      return "OT" // Default fallback
    }
  } catch (error) {
    console.error("Error getting company prefix:", error)
    return "OT" // Default fallback
  }
}

