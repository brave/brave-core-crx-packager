/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  GH_TOKEN=... pnpm data-files-wallet-lists

import { fetchWalletLists, WALLET_LISTS_DIR } from '../lib/walletLists.js'
import util from '../lib/util.js'

util.installErrorHandlers()

const { tag, addressCount } = await fetchWalletLists(WALLET_LISTS_DIR)
console.log(`Fetched and verified brave/wallet-lists ${tag} (${addressCount} prohibited addresses)`)
