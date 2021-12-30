// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

contract Treasury {
    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
