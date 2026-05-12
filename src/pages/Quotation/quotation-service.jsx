"use client"

// Helper: returns current financial year as "YY-YY" (April = new FY start)
const getCurrentFinancialYear = () => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const financialYearStart = now.getMonth() >= 3 ? currentYear : currentYear - 1
  const financialYearEnd = financialYearStart + 1
  const startShort = String(financialYearStart).slice(-2)
  const endShort = String(financialYearEnd).slice(-2)
  return `${startShort}-${endShort}`
}

// Fetches the next quotation number from the backend Google Apps Script
export const getNextQuotationNumber = async (companyPrefix = "BS") => {
  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbwkvholGxpU6WFQt3i9pzctKXkBHsY-qkeJd8DenMCMANbKHq5rp3ULEV67uGrWhTDoag/exec"

  try {
    const params = {
      sheetName: "Make Quotation",
      action: "getNextQuotationNumber",
      companyPrefix: companyPrefix,
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
      // Fallback: BS-YY-YY-001
      return `${companyPrefix}-${getCurrentFinancialYear()}-001`
    }
  } catch (error) {
    console.error("Error getting next quotation number:", error)
    // Fallback: BS-YY-YY-001
    return `${companyPrefix}-${getCurrentFinancialYear()}-001`
  }
}

// Fetches company-specific prefix from the backend (always returns "BS" as default now)
export const getCompanyPrefix = async (companyName) => {
  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbwkvholGxpU6WFQt3i9pzctKXkBHsY-qkeJd8DenMCMANbKHq5rp3ULEV67uGrWhTDoag/exec"

  try {
    const params = {
      sheetName: "FMS",
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
      console.log("No prefix found, using default BS")
      return "BS" // Default fallback
    }
  } catch (error) {
    console.error("Error getting company prefix:", error)
    return "BS" // Default fallback
  }
}
