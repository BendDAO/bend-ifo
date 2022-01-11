// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BendCompetition} from "./BendCompetition.sol";

contract BendCompetitionRinkeby is BendCompetition {
    function getConfig() public pure override returns (Config memory config) {
        config.BEND_TOKEN_ADDRESS = address(
            0x0791A14d100bc773446adEf6570b71406A18fAA8
        );
        config.WETH_GATEWAY_ADDRESS = address(
            0x1aDF8093E66d8A48F97bCf1bA174845Ec013bBE3
        );
        config.TREASURY_ADDRESS = address(
            0x3Ef03697a005203589653d80AD885E3b85256D18
        );
        config.CRYPTO_PUNKS_ADDRESS = address(
            0x6389eA3Cf6dE815ba76d7Cf4C6Db6A7093471bcb
        );

        address[] memory list = new address[](5);
        list[0] = address(0x10cACFfBf3Cdcfb365FDdC4795079417768BaA74); // DOODLE
        list[1] = address(0x9C235dF4053a415f028b8386ed13ae8162843a6e); // MAYC
        list[2] = address(0xA1BaBAB6d6cf1DC9C87Be22D1d5142CF905016a4); // MEEBITS
        list[3] = address(0x588D1a07ccdb224cB28dCd8E3dD46E16B3a72b5e); // BAYC
        list[4] = address(0x1F912E9b691858052196F11Aff9d8B6f89951AbD); // COOL
        config.ERC721_NFT_ADDRESSES = list;

        config.START_TIMESTAMP = 0;
        config.END_TIMESTAMP = 9999999999;
        config.AUTO_DRAW_DIVIDEND_THRESHOLD = 100 * 10**18;
        config.LEND_POOL_SHARE = 8000;
        config.BEND_TOKEN_REWARD_PER_ETH_PER_NFT = 1 * 10**18;
        config.MAX_ETH_PAYMENT_PER_NFT = 1 * 10**18;

        return config;
    }
}
