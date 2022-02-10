// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BendCompetition} from "./BendCompetition.sol";

contract BendCompetitionTest is BendCompetition {
    Config CONFIG;
    mapping(address => bool) public PRIVATE_SALE_WHITELIST;

    constructor(Config memory config) {
        CONFIG = config;
    }

    function getConfig() public view override returns (Config memory config) {
        return CONFIG;
    }

    function isInPrivateSaleWhitelist(address addr)
        public
        view
        override
        returns (bool)
    {
        return PRIVATE_SALE_WHITELIST[addr];
    }

    function addToWhitelist(address[] calldata addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            PRIVATE_SALE_WHITELIST[addresses[i]] = true;
        }
    }

    function removeFromWhitelist(address[] calldata addresses)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < addresses.length; i++) {
            PRIVATE_SALE_WHITELIST[addresses[i]] = false;
        }
    }
}
