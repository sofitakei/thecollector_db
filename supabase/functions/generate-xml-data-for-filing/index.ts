// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { XMLParser, XMLBuilder } from 'npm:fast-xml-parser'

import { create } from 'npm:xmlbuilder2'

import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supaClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const party = item => ({
  'boir:PartyName': {
    'ce:PartyNameTypeCode': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': 'L', //Must equal "L" to associate this PartyName information with the legal name.
    },

    'ce:RawEntityIndividualLastName': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.last_name,
    },
    'ce:RawIndividualFirstName': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.first_name,
    },
    'ce:RawIndividualMiddleName': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.middle_name,
    },
    'ce:RawIndividualNameSuffixText': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.suffix,
    },
  },
}) //end boir:PartyName})

const address = item => ({
  'boir:Address': {
    'ce:RawCityText': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.city,
    },
    'ce:RawCountryCodeText': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.country_jurisdiction_code,
    },
    'ce:RawStateCodeText': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.state_code,
    },
    'ce:RawStreetAddress1Text': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.address,
    },
    'ce:RawZIPCode': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.zipcode,
    },
  },
})

const partyid = item => ({
  'boir:PartyIdentificationUID': {
    // 'ce:OriginalAttachmentFileName': {
    //   '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
    //   '#': 'license.jpg', //TODO???
    // },
    'ce:OtherIssuerCountryText': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.document_country_jurisdiction_code, //2-letter code
    },
    'ce:OtherIssuerStateText': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.document_state_code, //2-letter code
    },
    'ce:PartyIdentificationNumberText': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.document_number,
    },
    'ce:PartyIdentificationTypeCode': {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': item.document_type,
    },
  }, //end identification
})

const propertyXML = property => ({
  'boir:ReportingCompany': {
    'boir:ActivityPartyTypeCode': 62, //???
    'boir:FormationCountryCodeText': 'US',
    'boir:PartyName': {
      'ce:PartyNameTypeCode': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': 'L', //Must equal "L" to associate this PartyName information with the legal name.
      },
      'ce:RawPartyFullName': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': property.name,
      },
    },
    'boir:Address': {
      'ce:RawCityText': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': property.city,
      },
      'ce:RawCountryCodeText': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': property.country_jurisdiction_code,
      },
      'ce:RawStateCodeText': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': property.state_code,
      },
      'ce:RawStreetAddress1Text': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': property.address,
      },
      'ce:RawZIPCode': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': property.zipcode,
      },
    },
    'boir:PartyIdentification': {
      'ce:PartyIdentificationNumberText': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': property.tax_id_number,
      },
      'ce:PartyIdentificationTypeCode': {
        '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        '#': property.tax_id_type, //Must equal "2" EIN, "1" SSN/ITIN, or "9" Foreign.
      },
    }, //end boir:PartyIdentification,
  },
})
const ownerXML = owner => {
  return owner.fincen_id
    ? { 'boir:FinCENID': owner.fincen_id }
    : {
        'boir:ActivityPartyTypeCode': '64', //Must equal "64" to associate this Party information with the Beneficial Owner
        'boir:IndividualBirthDateText': owner.birth_date.replaceAll('-', ''), //YYYYMMDD
        ...party(owner),
        ...address(owner),
        ...partyid(owner),
      }
} //end boir:BeneficialOwner)

const boardXML = board =>
  board.fincen_id
    ? { 'boir:FinCENID': board.fincen_id }
    : {
        'boir:ActivityPartyTypeCode': '63', //Must equal "63" to associate this Party information
        'boir:IndividualBirthDateText': board.birth_date.replaceAll('-', ''),
        ...party(board),
        ...address(board),
        ...partyid(board),
      }

// item.property_role ==='board_member' ? 'ce:ResidentialAddressIndicator': {
//   '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
//   '#': 'Y', //for company applicants only?
// }, :{}
console.log('Hello from generate xml data for filing!')
const fillForm = async property_filing => {
  //return byte stream
  const builder = new XMLBuilder()
  const { filing_type, filing } = property_filing

  const owners = {
    'boir:BeneficialOwner': [
      filing.users
        .filter(({ property_role }) => property_role === 'owner')
        .map(ownerXML),
    ],
  }

  const board = {
    'boir:Applicant': [
      filing.users
        .filter(({ property_role }) => property_role === 'board_member')
        .map(boardXML),
    ],
  }

  const indicator_map = {
    initial: 'ce:InitialReportIndicator',
    correct: 'ce:CorrectsAmendsPriorReportIndicator',
    update: 'UpdatePriorReportIndicator',
    new: 'ReportingCompanyBecameExemptIndicator', //this is actually newly exempt
  }
  const filingIndicator = {
    [indicator_map[filing_type]]: {
      '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
      '#': 'Y', //get if is initial report
    },
  }

  const toConvert = {
    'boir:BSAForm': {
      '@xmlns:boir': 'http://www.fincen.gov/base/boir/2022-01-01',
      'boir:EFileSubmissionInformation': {
        'est:FilingType': {
          '@xmlns:est':
            'http://www.fincen.gov/bsa/efile-submission-types/2021-01-01',
          '#': 'BOIR',
        },

        'est:VersionNumber': {
          '@xmlns:est':
            'http://www.fincen.gov/bsa/efile-submission-types/2021-01-01',
          '#': '1.0.5',
        },

        'est:SubmitUrl': {
          '@xmlns:est':
            'http://www.fincen.gov/bsa/efile-submission-types/2021-01-01',
        },
      },

      'boir:FormTypeCode': 'BOIR',
      'boir:Activity': {
        'ce:FilingDateText': {
          '@xmlns:ce': 'http://www.fincen.gov/bsa/commonelements/2021-01-01',
        },
        'boir:ActivityAssociation': {
          ...filingIndicator,
        },
        ...propertyXML(filing.property),

        ...board,
        ...owners,
      },
    },
  }
  console.log('converting object to xml', toConvert)
  const doc = create(toConvert)
  const outputXML = doc.end({ prettyPrint: true })
  return outputXML
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const requestObject = await req.json()
  const { property_filing } = requestObject
  console.log({ requestObject })
  const { property_id, id } = property_filing
  console.log('trying to parse filing', property_filing)
  const result = await fillForm(property_filing)

  const { data, error } = await supaClient.storage
    .from('document_images')
    .upload(`${property_id}/filing/${id}/filing.xml`, result, {
      contentType: 'application/xml',
      upsert: true,
    })
  //console.log({ data, error })
  return new Response(result, {
    headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
    status: 200,
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-pdf-for-filing' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
