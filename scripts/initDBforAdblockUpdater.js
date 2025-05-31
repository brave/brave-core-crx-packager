import util from '../lib/util.js'
import { getListCatalog, regionalCatalogComponentId, resourcesComponentId } from '../lib/adBlockRustUtils.js'
import commander from 'commander'
import 'dotenv/config'
const initDB = async (commander) => {
  await util.createTableIfNotExists(commander.endpoint, commander.region)
  const catalog = await getListCatalog()
  const regionalItem = {
    title: 'iBrowe Ad Block Updater (Regional Catalog)',
    list_text_component: {
      component_id: regionalCatalogComponentId
    }
  }
  const resourceItem = {
    title: 'iBrowe Ad Block Updater (Resources)',
    list_text_component: {
      component_id: resourcesComponentId
    }
  }
  const dataUpdaterItem = {
    title: 'iBrowe Local Data Updater',
    list_text_component: {
      component_id: 'afalakplffnnnlkncjhbmahjfjhmlkal'
    }
  }
  const dataNTPItem = {
    title: 'iBrowe NTP Background Data (TH-ios)',
    list_text_component: {
      component_id: 'hgkbeeaccabnjfplcbbipalcbohmgknc'
    }
  }
  catalog.push(regionalItem)
  catalog.push(resourceItem)
  catalog.push(dataUpdaterItem)
  catalog.push(dataNTPItem)
  await Promise.all(
    catalog.map(entry =>
      util.insertExtension(
        commander.endpoint,
        commander.region,
        entry.list_text_component.component_id,
        `iBrowe Ad Block Updater (${entry.title})`
      )
    )
  )
}

const processJob = async (commander) => {
  await initDB(commander)
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-l, --local-run', 'Runs updater job without connecting anywhere remotely'))
  .parse(process.argv)
commander.region = process.env.S3_REGION
commander.endpoint = process.env.S3_ENDPOINT
await processJob(commander)